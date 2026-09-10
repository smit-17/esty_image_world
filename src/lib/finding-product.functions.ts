import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "jewelry-images";

export type FindingProductResult = {
  status: "created" | "duplicate";
  productId: string;
  productName: string;
  imagesCopied: number;
  imagesFailed: number;
};

type FindingRow = {
  id: string;
  code: string;
  title: string | null;
  source_sku: string | null;
  product_url: string | null;
  platform: string | null;
  brand: string | null;
  category: string | null;
  gender: string | null;
  style: string | null;
  priority: string | null;
  note: string | null;
  finding_by: string | null;
  assigned_to: string | null;
  main_image: string | null;
  image_seeds: unknown;
  image_path: string | null;
  extra: unknown;
};

type Extra = { section: string; label: string; value: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

function extraList(value: unknown): Extra[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((e) => e as Record<string, unknown>)
    .filter((e) => e && typeof e === "object")
    .map((e) => ({
      section: String(e["section"] ?? "Other"),
      label: String(e["label"] ?? ""),
      value: String(e["value"] ?? ""),
    }))
    .filter((e) => e.label && e.value);
}

function pick(extras: Extra[], labels: string[]): string | null {
  for (const label of labels) {
    const hit = extras.find((e) => e.label.toLowerCase() === label.toLowerCase());
    if (hit?.value) return hit.value;
  }
  return null;
}

const IMAGE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
};

/**
 * Turns a saved finding into a real product in the existing Products system:
 * one products row plus one product_images row per reference image, copied
 * into that product's own storage folder. Nothing about Products changes.
 */
async function convertFinding(
  supabase: Db,
  userId: string,
  findingId: string,
  force: boolean,
): Promise<FindingProductResult> {
  const { data: findingRow, error: findingError } = await supabase
    .from("findings")
    .select("*")
    .eq("id", findingId)
    .single();
  if (findingError || !findingRow) throw new Error("This finding could not be read.");
  const finding = findingRow as unknown as FindingRow;

  const extras = extraList(finding.extra);
  const sourceUrl = finding.product_url?.trim() || null;
  const listingId = pick(extras, ["Listing / product ID", "Listing ID"]);
  const sourceSku = finding.source_sku?.trim() || pick(extras, ["Source SKU"]);

  /* ---------- duplicate guard ---------- */
  if (!force) {
    const orParts = [`finding_id.eq.${finding.id}`];
    if (sourceUrl) orParts.push(`source_url.eq.${sourceUrl}`, `reference_url.eq.${sourceUrl}`);
    if (listingId) orParts.push(`source_listing_id.eq.${listingId}`);
    if (sourceSku) orParts.push(`source_sku.eq.${sourceSku}`);
    const { data: existing } = await supabase
      .from("products")
      .select("id, name")
      .or(orParts.join(","))
      .limit(1);
    const hit = (existing ?? [])[0] as unknown as { id: string; name: string } | undefined;
    if (hit) {
      return {
        status: "duplicate",
        productId: hit.id,
        productName: hit.name,
        imagesCopied: 0,
        imagesFailed: 0,
      };
    }
  }

  /* ---------- the product row ---------- */
  const name = finding.title?.trim() || finding.code;
  const insert: Record<string, unknown> = {
    name,
    category: finding.category?.trim() || "Uncategorised",
    team_member: finding.assigned_to?.trim() || finding.finding_by?.trim() || "Unassigned",
    notes: finding.note?.trim() || null,
    sku: sourceSku || finding.code,
    subcategory: pick(extras, ["Subcategory"]) ?? finding.style ?? null,
    product_type: pick(extras, ["Product type"]) ?? null,
    reference_url: sourceUrl,
    created_by: userId,
    updated_by: userId,
    source_type: "FINDING",
    finding_id: finding.id,
    finding_code: finding.code,
    source_url: sourceUrl,
    source_platform: finding.platform ?? null,
    source_brand: finding.brand ?? pick(extras, ["Brand / shop"]),
    source_seller: pick(extras, ["Seller name"]),
    source_listing_id: listingId,
    source_sku: sourceSku,
    source_price: pick(extras, ["Price"]),
    source_currency: pick(extras, ["Currency"]),
    source_description: pick(extras, ["Description", "Short description"]),
    source_tags: extras.filter((e) => e.section === "Tags").map((e) => e.value),
    source_details: extras,
    source_found_by: finding.finding_by,
    source_assigned_to: finding.assigned_to,
    source_priority: finding.priority,
  };

  const { data: created, error: createError } = await supabase
    .from("products")
    .insert(insert)
    .select("id, name")
    .single();
  if (createError || !created)
    throw new Error(createError?.message ?? "The product could not be created.");
  const product = created as unknown as { id: string; name: string };

  /* ---------- images ---------- */
  const seeds = Array.isArray(finding.image_seeds)
    ? (finding.image_seeds as unknown[]).map(String)
    : [];
  const refs = Array.from(
    new Set([finding.main_image, finding.image_path, ...seeds].filter(Boolean) as string[]),
  );

  let copied = 0;
  let failed = 0;
  const rows: Record<string, unknown>[] = [];

  for (const [index, ref] of refs.entries()) {
    try {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      let blob: Blob;

      if (/^https?:\/\//i.test(ref)) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        try {
          const res = await fetch(ref, { headers: IMAGE_HEADERS, signal: controller.signal });
          if (!res.ok) throw new Error(`image request failed (${res.status})`);
          blob = await res.blob();
        } finally {
          clearTimeout(timer);
        }
      } else {
        const { data: file, error } = await supabase.storage.from(BUCKET).download(ref);
        if (error || !file) throw new Error("stored image could not be read");
        blob = file;
      }

      if (!blob.size) throw new Error("empty image");
      const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
      const ext = type.includes("png")
        ? "png"
        : type.includes("webp")
          ? "webp"
          : type.includes("gif")
            ? "gif"
            : "jpg";
      const path = `${product.id}/${key}.${ext}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
        cacheControl: "31536000",
        contentType: type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      rows.push({
        product_id: product.id,
        path,
        thumb_path: null,
        url: path,
        size_bytes: blob.size,
        position: index,
        uploaded_by: userId,
        qc_status: "PENDING",
        // Fetched from the original listing: reference only, never our product image.
        kind: "REFERENCE",
        source_url: /^https?:\/\//i.test(ref) ? ref : (finding.product_url ?? null),
      });
      copied += 1;
    } catch (err) {
      failed += 1;
      console.error(`[finding→product] image skipped: ${(err as Error).message}`);
    }
  }

  if (rows.length) {
    const { error: imageError } = await supabase.from("product_images").insert(rows);
    if (imageError) {
      console.error(`[finding→product] image rows failed: ${imageError.message}`);
      failed += rows.length;
      copied = 0;
    }
    // No cover is set here — reference images must never become the product cover.
  }

  return {
    status: "created",
    productId: product.id,
    productName: product.name,
    imagesCopied: copied,
    imagesFailed: failed,
  };
}

export const createProductFromFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { findingId: string; force?: boolean }) => {
    if (!data?.findingId) throw new Error("A finding is required.");
    return data;
  })
  .handler(async ({ data, context }): Promise<FindingProductResult> => {
    const { supabase, userId } = context;
    return convertFinding(supabase as Db, userId, data.findingId, Boolean(data.force));
  });

export type BackfillResult = { checked: number; created: number; skipped: number; failed: number };

/**
 * One-off repair: every saved finding that has no linked product gets one,
 * using the exact same conversion as the normal save flow.
 */
export const backfillFindingProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BackfillResult> => {
    const supabase = context.supabase as Db;
    const { userId } = context;

    const { data: findings, error } = await supabase
      .from("findings")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);

    const { data: linked } = await supabase
      .from("products")
      .select("finding_id")
      .not("finding_id", "is", null)
      .limit(2000);
    const has = new Set(
      ((linked ?? []) as { finding_id: string | null }[])
        .map((r) => r.finding_id)
        .filter(Boolean) as string[],
    );

    const missing = ((findings ?? []) as { id: string }[]).filter((f) => !has.has(f.id));
    const out: BackfillResult = { checked: missing.length, created: 0, skipped: 0, failed: 0 };

    for (const f of missing.slice(0, 100)) {
      try {
        const res = await convertFinding(supabase, userId, f.id, false);
        if (res.status === "created") out.created += 1;
        else out.skipped += 1;
      } catch (err) {
        out.failed += 1;
        console.error(`[finding→product] backfill failed for ${f.id}: ${(err as Error).message}`);
      }
    }
    return out;
  });
