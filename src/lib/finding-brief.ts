import type { Product, ProductEstimate, ProductImage } from "@/lib/lepdo";

function num(v: unknown) {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Builds the plain-text "source brief" for a product created from a Finding.
 * Everything here is what the *source listing* claimed — never LEPDO-confirmed
 * specs or our final selling price. Sections are labelled accordingly.
 */

export type BriefSection = { title: string; lines: string[] };

function line(label: string, value?: string | null): string | null {
  const v = value == null ? "" : String(value).trim();
  return v ? `${label}: ${v}` : null;
}

function clean(lines: (string | null)[]): string[] {
  return lines.filter(Boolean) as string[];
}

function detailsOf(product: Product, section: string) {
  return (product.source_details ?? [])
    .filter((d) => d?.section === section && d?.value?.trim())
    .map((d) => `${d.label}: ${d.value.trim()}`);
}

export function briefSections(product: Product, referenceImages: ProductImage[] = []): BriefSection[] {
  const sections: BriefSection[] = [];

  sections.push({
    title: "Product",
    lines: clean([
      line("SKU", product.sku),
      line("Product name", product.name),
      line("Category", product.category),
      line("Subcategory", product.subcategory),
      line("Product type", product.product_type),
    ]),
  });

  sections.push({
    title: "Source / Finding (as claimed by the source listing)",
    lines: clean([
      line("Finding code", product.finding_code),
      
      line("Original product URL", product.source_url),
      line("Reference / inspiration URL", product.reference_url),
      line("Platform", product.source_platform),
      line("Shop / brand", product.source_brand),
      line("Seller", product.source_seller),
      line("Listing ID", product.source_listing_id),
      line("Source SKU", product.source_sku),
      line("Found by", product.source_found_by),
      line("Assigned to", product.source_assigned_to),
      line("Priority", product.source_priority),
    ]),
  });

  sections.push({
    title: "Source price (not our selling price)",
    lines: clean([
      line("Source price", [product.source_price, product.source_currency].filter(Boolean).join(" ")),
      ...detailsOf(product, "Price & Variations").map((l) => `Source ${l}`),
    ]),
  });

  sections.push({
    title: "Source specifications (unverified — not LEPDO-confirmed)",
    lines: clean([
      ...detailsOf(product, "Materials & Specs").map((l) => `Source ${l}`),
      ...detailsOf(product, "Product Details").map((l) => `Source ${l}`),
      ...detailsOf(product, "Shop & Ratings").map((l) => `Source ${l}`),
    ]),
  });

  sections.push({
    title: "Source description",
    lines: clean([product.source_description?.trim() ?? null]),
  });

  sections.push({
    title: "Source tags",
    lines: (product.source_tags ?? []).filter(Boolean).length
      ? [(product.source_tags ?? []).filter(Boolean).join(", ")]
      : [],
  });

  sections.push({
    title: "Finding notes",
    lines: clean([product.notes?.trim() ?? null]),
  });

  sections.push({
    title: "Reference image URLs (links only — image files are not copied)",
    lines: referenceImages
      .map((i, idx) => i.source_url?.trim() && `${idx + 1}. ${i.source_url.trim()}`)
      .filter(Boolean) as string[],
  });

  return sections.filter((s) => s.lines.length > 0);
}

export function sectionText(section: BriefSection): string {
  return `${section.title}\n${section.lines.join("\n")}`;
}

export function buildFindingBrief(product: Product, referenceImages: ProductImage[] = []): string {
  return briefSections(product, referenceImages).map(sectionText).join("\n\n");
}

/**
 * One-click "Copy All for ChatGPT" brief. Everything useful about the product in
 * a clean, paste-ready text. Skips empty sections, internal IDs and duplicates;
 * images are summarised as counts (plus source URLs when available).
 */
export function buildChatGptBrief(
  product: Product,
  opts: {
    estimate?: ProductEstimate;
    referenceImages?: ProductImage[];
    ourImagesCount?: number;
    createdAt?: string;
  } = {},
): string {
  const sections: BriefSection[] = [];
  const refs = opts.referenceImages ?? [];

  sections.push({
    title: "PRODUCT INFORMATION",
    lines: clean([
      line("SKU", product.sku),
      line("Title", product.name),
      line("Category", product.category),
      line("Subcategory", product.subcategory),
      line("Product type", product.product_type),
      line("Team member", product.team_member && product.team_member !== "Unassigned" ? product.team_member : null),
      line("Created", opts.createdAt),
    ]),
  });

  sections.push({
    title: "SOURCE / FINDING",
    lines: clean([
      line("Platform", product.source_platform),
      line("Brand / Shop", product.source_brand),
      line("Seller", product.source_seller),
      line("Finding ID", product.finding_code),
      line("Source SKU / Listing ID", product.source_listing_id || product.source_sku),
      line("Original URL", product.source_url),
      line("Reference / inspiration link", product.reference_url),
      line("Priority", product.source_priority),
      line("Found by", product.source_found_by),
    ]),
  });

  const productDetails = detailsOf(product, "Product Details");
  if (productDetails.length || product.source_description?.trim()) {
    sections.push({
      title: "PRODUCT DETAILS",
      lines: clean([...productDetails, product.source_description?.trim() ?? null]),
    });
  }

  const priceLines = clean([
    line("Source price", [product.source_price, product.source_currency].filter(Boolean).join(" ")),
    ...detailsOf(product, "Price & Variations").map((l) => `Source ${l}`),
  ]);
  if (priceLines.length) sections.push({ title: "PRICE & VARIATIONS", lines: priceLines });

  const materialLines = clean([
    ...detailsOf(product, "Materials & Specs"),
    ...detailsOf(product, "Shop & Ratings"),
  ]);
  if (materialLines.length) sections.push({ title: "MATERIALS / JEWELRY DETAILS", lines: materialLines });

  const gold = num(opts.estimate?.gold_weight);
  const diamonds = (opts.estimate?.diamonds ?? []).filter((r) => num(r?.weight) > 0 || r?.note?.trim());
  const diamondTotal = diamonds.reduce((s, r) => s + num(r.weight), 0);
  if (gold > 0 || diamonds.length) {
    sections.push({
      title: "METAL & DIAMOND",
      lines: clean([
        gold > 0 ? `14KT Gold weight: ${gold.toFixed(2)} gm` : null,
        ...diamonds.map(
          (r, i) =>
            `Diamond ${i + 1}: ${num(r.weight).toFixed(2)} ct${r.note?.trim() ? ` — ${r.note.trim()}` : ""}`,
        ),
        diamonds.length ? `Total diamond weight: ${diamondTotal.toFixed(2)} ct` : null,
      ]),
    });
  }

  if (product.notes?.trim()) {
    sections.push({ title: "NOTES", lines: [product.notes.trim()] });
  }

  const tags = (product.source_tags ?? []).filter(Boolean);
  if (tags.length) sections.push({ title: "TAGS / KEYWORDS", lines: [tags.join(", ")] });

  const our = opts.ourImagesCount ?? 0;
  if (refs.length || our) {
    sections.push({
      title: "IMAGES",
      lines: clean([
        `Reference Images: ${refs.length}`,
        `Our Images: ${our}`,
        ...(refs
          .map((i, idx) => (i.source_url?.trim() ? `Reference ${idx + 1}: ${i.source_url.trim()}` : null))
          .filter(Boolean) as string[]),
      ]),
    });
  }

  return sections
    .filter((s) => s.lines.length > 0)
    .map((s) => `${s.title}\n${s.lines.join("\n")}`)
    .join("\n\n");
}

/** True when there is any source/finding information worth copying. */
export function hasSourceInfo(product: Product): boolean {
  return Boolean(
    product.finding_id ||
      product.finding_code ||
      product.source_url ||
      product.source_platform ||
      product.source_brand ||
      product.source_description ||
      product.source_price ||
      (product.source_tags ?? []).length ||
      (product.source_details ?? []).length,
  );
}

/** Copy to clipboard, resolving false when the browser refuses. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the manual fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
