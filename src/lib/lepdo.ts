import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "jewelry-images";
export const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB plan allowance
export const MAX_IMAGES = 15;

export const ETSY_STATUSES = [
  { value: "not_listed", label: "Not Listed" },
  { value: "draft", label: "Draft" },
  { value: "live", label: "Live" },
  { value: "sold_out", label: "Sold Out" },
  { value: "deactivated", label: "Deactivated" },
] as const;

export type EtsyStatus = (typeof ETSY_STATUSES)[number]["value"];

export function etsyStatusLabel(value?: string | null): string {
  return ETSY_STATUSES.find((s) => s.value === (value ?? "not_listed"))?.label ?? "Not Listed";
}

export type Product = {
  id: string;
  name: string;
  category: string;
  team_member: string;
  notes: string | null;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
  etsy_listed?: boolean;
  etsy_account?: string | null;
  etsy_listed_at?: string | null;
  etsy_status?: EtsyStatus | string;
  etsy_url?: string | null;
  etsy_listed_by?: string | null;
};

export type ProductImage = {
  id: string;
  product_id: string;
  path: string;
  thumb_path: string | null;
  url: string;
  size_bytes: number;
  position: number;
  created_at: string;
};

export type Category = { id: string; name: string; created_at: string };
export type TeamMember = { id: string; name: string; email: string | null; created_at: string };

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

export async function fetchProduct(id: string): Promise<Product> {
  const { data, error } = await supabase.from("products" as never).select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as Product;
}

export async function fetchImages(productId?: string): Promise<ProductImage[]> {
  let q = supabase.from("product_images" as never).select("*").order("position");
  if (productId) q = q.eq("product_id", productId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ProductImage[];
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories" as never).select("*").order("name");
  if (error) throw error;
  return (data ?? []) as unknown as Category[];
}

export async function fetchTeam(): Promise<TeamMember[]> {
  const { data, error } = await supabase.from("team_members" as never).select("*").order("name");
  if (error) throw error;
  return (data ?? []) as unknown as TeamMember[];
}

/* ------------------------------------------------------------------ */
/* Signed URLs (private bucket) with an in-memory cache                */
/* ------------------------------------------------------------------ */

const SIGN_TTL = 60 * 60 * 8; // 8 hours
const signCache = new Map<string, { url: string; expires: number }>();

export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return {};

  const now = Date.now();
  const map: Record<string, string> = {};
  const missing: string[] = [];

  for (const p of unique) {
    const hit = signCache.get(p);
    if (hit && hit.expires > now) map[p] = hit.url;
    else missing.push(p);
  }
  if (!missing.length) return map;

  // Sign in chunks so a huge library doesn't create one giant request.
  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += 100) chunks.push(missing.slice(i, i + 100));

  const results = await Promise.all(
    chunks.map((chunk) => supabase.storage.from(BUCKET).createSignedUrls(chunk, SIGN_TTL)),
  );

  for (const { data } of results) {
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        map[item.path] = item.signedUrl;
        signCache.set(item.path, { url: item.signedUrl, expires: now + (SIGN_TTL - 300) * 1000 });
      }
    }
  }
  return map;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${mb.toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/* Image compression + parallel upload                                 */
/* ------------------------------------------------------------------ */

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

async function resizeToBlob(
  source: ImageBitmap | HTMLImageElement,
  maxDim: number,
  quality: number,
): Promise<Blob> {
  const w = "width" in source ? source.width : 0;
  const h = "height" in source ? source.height : 0;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
      "image/webp",
      quality,
    ),
  );
}

export type UploadedImage = { path: string; thumbPath: string; size: number };

/**
 * Compress + upload one file into this product's own folder.
 * Full-size (max 2200px) and a lightweight thumbnail (max 480px) are stored.
 */
export async function uploadOneImage(productId: string, file: File): Promise<UploadedImage> {
  const bitmap = await loadBitmap(file);
  const [full, thumb] = await Promise.all([
    resizeToBlob(bitmap, 2200, 0.9),
    resizeToBlob(bitmap, 480, 0.72),
  ]);
  if ("close" in bitmap) bitmap.close();

  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`;
  const path = `${productId}/${key}`;
  const thumbPath = `${productId}/thumbs/${key}`;

  const [main, small] = await Promise.all([
    supabase.storage.from(BUCKET).upload(path, full, {
      cacheControl: "31536000",
      upsert: false,
      contentType: "image/webp",
    }),
    supabase.storage.from(BUCKET).upload(thumbPath, thumb, {
      cacheControl: "31536000",
      upsert: false,
      contentType: "image/webp",
    }),
  ]);
  if (main.error) throw main.error;
  if (small.error) throw small.error;

  return { path, thumbPath, size: full.size + thumb.size };
}

/** Upload many files in parallel (bounded), reporting per-file progress. */
export async function uploadImagesParallel(
  productId: string,
  items: { id: string; file: File }[],
  onProgress: (id: string, state: "uploading" | "done" | "error", error?: string) => void,
  concurrency = 3,
): Promise<Record<string, UploadedImage>> {
  const out: Record<string, UploadedImage> = {};
  let cursor = 0;
  let firstError: Error | null = null;

  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      onProgress(item.id, "uploading");
      try {
        out[item.id] = await uploadOneImage(productId, item.file);
        onProgress(item.id, "done");
      } catch (e) {
        const err = e as Error;
        firstError = firstError ?? err;
        onProgress(item.id, "error", err.message);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  if (firstError) throw firstError;
  return out;
}

/** Remove image rows + their storage objects (scoped to those exact paths only). */
export async function deleteImageRecords(images: ProductImage[]) {
  if (!images.length) return;
  const paths = images.flatMap((i) => [i.path, ...(i.thumb_path ? [i.thumb_path] : [])]);
  await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase
    .from("product_images" as never)
    .delete()
    .in("id", images.map((i) => i.id));
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const images = await fetchImages(id);
  if (images.length) {
    await supabase.storage
      .from(BUCKET)
      .remove(images.flatMap((i) => [i.path, ...(i.thumb_path ? [i.thumb_path] : [])]));
  }
  const { error } = await supabase.from("products" as never).delete().eq("id", id);
  if (error) throw error;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download a single full-resolution image. */
export async function downloadSingleImage(product: Product, image: ProductImage, index = 0) {
  const { data, error } = await supabase.storage.from(BUCKET).download(image.path);
  if (error || !data) throw new Error("Could not download this image");
  const ext = image.path.split(".").pop() ?? "webp";
  triggerDownload(data, `${slugify(product.name)}-${String(index + 1).padStart(2, "0")}.${ext}`);
}

/** Download every image of a product as a single .zip file (parallel fetch). */
export async function downloadProductImages(
  product: Product,
  images: ProductImage[],
  onProgress?: (done: number, total: number) => void,
) {
  if (!images.length) throw new Error("This product has no images to download");
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  let done = 0;
  const files = await Promise.all(
    images.map(async (img, i) => {
      const { data } = await supabase.storage.from(BUCKET).download(img.path);
      done += 1;
      onProgress?.(done, images.length);
      return { i, data };
    }),
  );

  for (const { i, data } of files) {
    if (!data) continue;
    const ext = images[i].path.split(".").pop() ?? "webp";
    zip.file(`${slugify(product.name)}-${String(i + 1).padStart(2, "0")}.${ext}`, data);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${slugify(product.name)}-images.zip`);
}

/* ------------------------------------------------------------------ */
/* Etsy tracking                                                       */
/* ------------------------------------------------------------------ */

export type EtsyUpdate = {
  status: EtsyStatus;
  account: string | null;
  url: string | null;
  listedBy: string | null;
  listedAt?: string | null;
};

export async function updateEtsy(id: string, patch: EtsyUpdate) {
  const listed = patch.status !== "not_listed";
  const { error } = await supabase
    .from("products" as never)
    .update({
      etsy_status: patch.status,
      etsy_listed: listed,
      etsy_account: listed ? patch.account : null,
      etsy_url: listed ? patch.url : null,
      etsy_listed_by: listed ? patch.listedBy : null,
      etsy_listed_at: listed ? (patch.listedAt ?? new Date().toISOString()) : null,
    } as never)
    .eq("id", id);
  if (error) throw error;
}

export type EtsyAccount = { id: string; name: string; created_at: string };

/** Etsy accounts configured in Settings, merged with any names already used on products. */
export async function fetchEtsyAccounts(): Promise<string[]> {
  const [managed, used] = await Promise.all([
    supabase.from("etsy_accounts" as never).select("name").order("name"),
    supabase.from("products" as never).select("etsy_account").not("etsy_account", "is", null),
  ]);
  const names = [
    ...((managed.data ?? []) as unknown as { name: string }[]).map((r) => r.name),
    ...((used.data ?? []) as unknown as { etsy_account: string | null }[]).map(
      (r) => r.etsy_account ?? "",
    ),
  ]
    .map((n) => n.trim())
    .filter(Boolean);
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

/** Managed Etsy account rows (Settings screen). */
export async function fetchEtsyAccountRows(): Promise<EtsyAccount[]> {
  const { data, error } = await supabase.from("etsy_accounts" as never).select("*").order("name");
  if (error) throw error;
  return (data ?? []) as unknown as EtsyAccount[];
}

export async function addEtsyAccount(name: string) {
  const { error } = await supabase
    .from("etsy_accounts" as never)
    .insert({ name: name.trim() } as never);
  if (error) throw error;
}

export async function deleteEtsyAccount(id: string) {
  const { error } = await supabase.from("etsy_accounts" as never).delete().eq("id", id);
  if (error) throw error;
}

