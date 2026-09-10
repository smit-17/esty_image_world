import { createServerFn } from "@tanstack/react-start";

export type LogEntry = { step: string; status: string; detail: string };

export const NOT_FOUND = "Not found";

export const FIELD_LABELS = {
  title: "Title",
  listingId: "Listing / product ID",
  sku: "Source SKU",
  canonicalUrl: "Canonical URL",
  platform: "Platform",
  productType: "Product type",
  category: "Category",
  subcategory: "Subcategory",
  breadcrumb: "Category path",
  description: "Description",
  shortDescription: "Short description",
  brand: "Brand / shop",
  seller: "Seller name",
  shopUrl: "Shop URL",
  price: "Price",
  salePrice: "Sale price",
  currency: "Currency",
  availability: "Availability",
  rating: "Rating",
  reviewCount: "Review count",
  materials: "Materials",
  metal: "Metal",
  metalColor: "Metal colour",
  karat: "Karat",
  diamondType: "Diamond type",
  diamondShape: "Diamond shape",
  diamondWeight: "Diamond weight",
  gemstone: "Gemstone details",
  size: "Size / dimensions",
  variations: "Variations",
  options: "Available options",
  personalization: "Personalisation",
  shipping: "Shipping",
} as const;

export type FieldKey = keyof typeof FIELD_LABELS;

export const FIELD_SECTIONS: Record<FieldKey, string> = {
  title: "Product Details",
  listingId: "Product Details",
  sku: "Product Details",
  canonicalUrl: "Product Details",
  platform: "Product Details",
  productType: "Product Details",
  category: "Product Details",
  subcategory: "Product Details",
  breadcrumb: "Product Details",
  description: "Product Details",
  shortDescription: "Product Details",
  brand: "Shop & Ratings",
  seller: "Shop & Ratings",
  shopUrl: "Shop & Ratings",
  rating: "Shop & Ratings",
  reviewCount: "Shop & Ratings",
  price: "Price & Variations",
  salePrice: "Price & Variations",
  currency: "Price & Variations",
  availability: "Price & Variations",
  variations: "Price & Variations",
  options: "Price & Variations",
  personalization: "Price & Variations",
  shipping: "Price & Variations",
  materials: "Materials & Specs",
  metal: "Materials & Specs",
  metalColor: "Materials & Specs",
  karat: "Materials & Specs",
  diamondType: "Materials & Specs",
  diamondShape: "Materials & Specs",
  diamondWeight: "Materials & Specs",
  gemstone: "Materials & Specs",
  size: "Materials & Specs",
};

export type ProductField = { value: string; source: string };

export type ProductData = {
  sourceUrl: string;
  fields: Partial<Record<FieldKey, ProductField>>;
  images: { url: string; sourceUrl?: string }[];
  tags: string[];
};

export type FetchResult = {
  ok: boolean;
  message: string;
  log: LogEntry[];
  data: ProductData;
};

/* ------------------------------------------------------------------ utils */

function decode(text: string) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .trim();
}

function metaContent(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${key}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) return decode(m[1]);
  }
  return "";
}

function metaAll(html: string, key: string) {
  const out: string[] = [];
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) if (m[1]) out.push(decode(m[1]));
  return out;
}

function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1]!.trim().replace(/^<!--/, "").replace(/-->$/, "");
    try {
      out.push(JSON.parse(raw));
    } catch {
      /* ignore malformed blocks */
    }
  }
  return out;
}

function flatten(nodes: unknown[]): Record<string, unknown>[] {
  const flat: Record<string, unknown>[] = [];
  const visit = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (n && typeof n === "object") {
      const obj = n as Record<string, unknown>;
      flat.push(obj);
      if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(visit);
    }
  };
  nodes.forEach(visit);
  return flat;
}

function hasType(node: Record<string, unknown>, needle: string) {
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === "string" && t.toLowerCase().includes(needle));
}

function asString(value: unknown): string {
  if (typeof value === "string") return decode(value);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(asString).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const k of ["name", "value", "@value", "url"]) {
      if (typeof obj[k] === "string" || typeof obj[k] === "number") return asString(obj[k]);
    }
  }
  return "";
}

function stripTags(html: string) {
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function absolute(url: string, base: string) {
  try {
    return new URL(url, base).toString();
  } catch {
    return "";
  }
}

/* --------------------------------------------------------------- fetching */

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  pragma: "no-cache",
  "sec-ch-ua": '"Chromium";v="124", "Not:A-Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

const BOT_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

async function getText(url: string, headers: Record<string, string>, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, redirect: "follow", signal: controller.signal });
    const body = res.ok ? await res.text() : "";
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Managed browser-rendering service. Renders the page like a real browser and
 * bypasses most shop blocks (Etsy, Pinterest, Shopify, brand sites).
 */
async function renderedRead(url: string): Promise<{ status: number; body: string }> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const firecrawlKey = process.env["FIRECRAWL_API_KEY"];
  if (!lovableKey || !firecrawlKey) return { status: 0, body: "" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/firecrawl/v2/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": firecrawlKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        url,
        formats: ["rawHtml", "links"],
        onlyMainContent: false,
        waitFor: 2500,
        timeout: 40000,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[fetch-product-data] rendered read failed [${res.status}]: ${text.slice(0, 500)}`);
      return { status: res.status, body: "" };
    }
    const payload = JSON.parse(text) as {
      rawHtml?: string;
      html?: string;
      data?: { rawHtml?: string; html?: string };
    };
    const body = payload.rawHtml ?? payload.html ?? payload.data?.rawHtml ?? payload.data?.html ?? "";
    return { status: res.status, body };
  } catch (err) {
    console.error(`[fetch-product-data] rendered read error: ${(err as Error).message}`);
    return { status: 0, body: "" };
  } finally {
    clearTimeout(timer);
  }
}

/** Cheapest methods first; stops as soon as one returns a usable page. */
async function loadHtml(url: string, log: LogEntry[], platformLabel: string): Promise<string> {
  const blocked = /etsy\.com|pinterest\.|pin\.it|amazon\.|aliexpress\./i.test(url);
  const attempts: { step: string; run: () => Promise<{ status: number; body: string }> }[] = [
    { step: "Direct read", run: () => getText(url, BROWSER_HEADERS) },
    { step: "Search-engine view", run: () => getText(url, BOT_HEADERS) },
    { step: "Browser-rendered read", run: () => renderedRead(url) },
    {
      step: "Text-render service",
      run: () =>
        getText(
          `https://r.jina.ai/${url}`,
          { ...BROWSER_HEADERS, "x-return-format": "html", "x-timeout": "25" },
          25000,
        ),
    },
    {
      step: "Cached page copy",
      run: () =>
        getText(
          `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
          { ...BROWSER_HEADERS },
          18000,
        ),
    },
  ];

  // Shops that reliably block plain requests go straight to browser rendering.
  if (blocked) {
    const rendered = attempts.splice(2, 1)[0]!;
    attempts.unshift(rendered);
  }

  log.push({ step: "Link detected", status: "Complete", detail: platformLabel });

  // A page that carries product signals; anything else is a block/captcha shell.
  const looksUseful = (body: string) =>
    /og:title|application\/ld\+json|<h1|product:price|__NEXT_DATA__/i.test(body) &&
    !/captcha|are you a human|access denied|request blocked/i.test(body.slice(0, 4000));

  let best = "";
  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i]!;
    try {
      const { status, body } = await attempt.run();
      if (body && body.length > 500) {
        if (looksUseful(body)) {
          log.push({ step: attempt.step, status: "Complete", detail: "Page source received." });
          return body;
        }
        if (body.length > best.length) best = body;
        log.push({ step: attempt.step, status: "Partial", detail: "Page returned, but product details were hidden." });
        continue;
      }
      log.push({
        step: attempt.step,
        status: "Failed",
        detail: status === 403 || status === 401 ? "The shop blocked this request." : "No page content returned.",
      });
    } catch (err) {
      log.push({
        step: attempt.step,
        status: "Failed",
        detail: (err as Error).name === "AbortError" ? "Took too long." : "Could not reach the page.",
      });
    }
  }
  return best;
}

/** Etsy's public oEmbed endpoint still answers when the listing page blocks us. */
async function etsyOembed(url: string) {
  try {
    const { status, body } = await getText(
      `https://www.etsy.com/oembed?url=${encodeURIComponent(url)}`,
      { ...BROWSER_HEADERS, accept: "application/json" },
      8000,
    );
    if (status !== 200 || !body) return null;
    return JSON.parse(body) as { title?: string; author_name?: string; author_url?: string; thumbnail_url?: string };
  } catch {
    return null;
  }
}

/** Shopify exposes the full product record as JSON next to the page. */
async function shopifyProductJson(url: string) {
  try {
    const u = new URL(url);
    const m = /\/products\/([^/?#]+)/.exec(u.pathname);
    if (!m) return null;
    const endpoint = `${u.origin}${u.pathname.split("/products/")[0]}/products/${m[1]}.js`;
    const { status, body } = await getText(endpoint, { ...BROWSER_HEADERS, accept: "application/json" }, 9000);
    if (status !== 200 || !body.trim().startsWith("{")) return null;
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- extractor */

const JEWELLERY_PATTERNS: { key: FieldKey; re: RegExp }[] = [
  { key: "karat", re: /\b(9|10|14|18|21|22|24)\s?(?:k|kt|ct)\b(?:\s?gold)?/i },
  { key: "metal", re: /\b(sterling silver|white gold|yellow gold|rose gold|solid gold|platinum|titanium|brass|silver|gold)\b/i },
  { key: "metalColor", re: /\b(white|yellow|rose|two[- ]tone|tri[- ]tone)\s+gold\b/i },
  { key: "diamondType", re: /\b(lab[- ]grown|lab created|natural|moissanite|cvd|hpht)\s+diamonds?\b/i },
  { key: "diamondShape", re: /\b(round|oval|pear|marquise|emerald|princess|cushion|baguette|radiant|asscher|heart)\s*(?:cut|shape)?\s*diamonds?\b/i },
  { key: "diamondWeight", re: /\b(\d+(?:\.\d+)?)\s?(?:ct|ctw|carat)\b/i },
  { key: "gemstone", re: /\b(ruby|emerald|sapphire|opal|pearl|topaz|amethyst|turquoise|garnet|aquamarine|citrine|onyx|moonstone)\b/i },
  { key: "size", re: /\b(?:size|length|width|diameter)\s*[:\-]?\s*([0-9][0-9./\s-]{0,12}\s?(?:mm|cm|in|inch|inches)?)/i },
  { key: "personalization", re: /\b(personali[sz]ed|custom engraving|engraving available|monogram)\b/i },
];

/* ------------------------------------------------------------------- cache */

type CacheEntry = { at: number; result: FetchResult };
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 10 * 60 * 1000;

/** Reads a public product page and returns whatever it can honestly find. */
export const fetchProductData = createServerFn({ method: "POST" })
  .inputValidator((data: { url: string; html?: string }) => {
    if (!data?.url || !/^https?:\/\//i.test(data.url)) throw new Error("A full product link is required.");
    return data;
  })
  .handler(async ({ data }): Promise<FetchResult> => {
    if (!data.html) {
      const hit = cache.get(data.url);
      if (hit && Date.now() - hit.at < CACHE_MS) {
        return {
          ...hit.result,
          log: [...hit.result.log, { step: "Cache", status: "Complete", detail: "Reused a recent read of this link." }],
        };
      }
    }

    const log: LogEntry[] = [];
    const result: ProductData = { sourceUrl: data.url, fields: {}, images: [], tags: [] };

    let host = "";
    try {
      host = new URL(data.url).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
    const isEtsy = /(^|\.)etsy\.com$/i.test(host);
    const isPinterest = /(^|\.)(pinterest\.[a-z.]+|pin\.it)$/i.test(host);

    const set = (key: FieldKey, value: unknown, source: string) => {
      const v = typeof value === "string" ? value.trim() : asString(value);
      if (v && v !== "null" && v !== "undefined" && !result.fields[key]?.value) {
        result.fields[key] = { value: v.slice(0, 4000), source };
      }
    };
    const addImage = (raw: string, source?: string) => {
      let u = raw.trim();
      if (u.startsWith("//")) u = `https:${u}`;
      if (!/^https?:\/\//i.test(u)) u = absolute(u, data.url);
      if (!/^https?:\/\//i.test(u)) return;
      if (/sprite|logo|icon|favicon|placeholder|blank\.gif|1x1|pixel/i.test(u)) return;
      // upgrade known thumbnail patterns to full resolution
      u = u.replace(/il_(?:75|100|170|180|300|340|570)x\w*\./, "il_fullxfull.");
      u = u.replace(/(_(?:\d{2,3})x(?:\d{2,3})?)(\.(?:jpe?g|png|webp))/i, "$2");
      if (result.images.length < 40) result.images.push({ url: u, sourceUrl: source ?? u });
    };

    let html = data.html ?? "";
    const platformLabel = isEtsy ? "Etsy" : isPinterest ? "Pinterest" : host || "Unknown site";

    if (html) {
      log.push({ step: "Pasted page", status: "Complete", detail: `${html.length} characters read.` });
    } else {
      html = await loadHtml(data.url, log, platformLabel);
    }

    /* ---------- Shopify JSON endpoint (fast, exact) ---------- */
    if (!data.html && (/shopify/i.test(html) || /\/products\//.test(data.url))) {
      const p = await shopifyProductJson(data.url);
      if (p) {
        log.push({ step: "Shop data file", status: "Complete", detail: "Shopify product record read." });
        set("title", p["title"], "Shop data");
        set("brand", p["vendor"], "Shop data");
        set("productType", p["product_type"], "Shop data");
        set("description", stripTags(asString(p["description"] ?? p["body_html"])), "Shop data");
        set("listingId", p["id"], "Shop data");
        const variants = Array.isArray(p["variants"]) ? (p["variants"] as Record<string, unknown>[]) : [];
        if (variants[0]) {
          const price = Number(variants[0]["price"]);
          if (!Number.isNaN(price)) set("price", String(price >= 1000 ? price / 100 : price), "Shop data");
          set("sku", variants[0]["sku"], "Shop data");
          const compare = Number(variants[0]["compare_at_price"]);
          if (compare) set("salePrice", String(compare >= 1000 ? compare / 100 : compare), "Shop data");
          set("availability", variants[0]["available"] ? "InStock" : "OutOfStock", "Shop data");
        }
        if (variants.length > 1) set("variations", variants.map((v) => asString(v["title"])).filter(Boolean).join(" | "), "Shop data");
        const options = Array.isArray(p["options"]) ? p["options"] : [];
        if (options.length) set("options", options.map(asString).filter(Boolean).join(" | "), "Shop data");
        const tags = p["tags"];
        if (Array.isArray(tags)) result.tags = tags.map(asString).filter(Boolean);
        for (const img of (Array.isArray(p["images"]) ? p["images"] : []) as unknown[]) addImage(asString(img), "Shop data");
      }
    }

    if (html) {
      /* ---------- Open Graph / meta tags ---------- */
      set("title", metaContent(html, "og:title") || metaContent(html, "twitter:title"), "Open Graph");
      set(
        "description",
        metaContent(html, "og:description") || metaContent(html, "description") || metaContent(html, "twitter:description"),
        "Open Graph",
      );
      set("shortDescription", metaContent(html, "twitter:description"), "Meta tags");
      set("brand", metaContent(html, "og:site_name") || metaContent(html, "product:brand"), "Open Graph");
      set("canonicalUrl", metaContent(html, "og:url"), "Open Graph");
      const canonical = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html);
      if (canonical?.[1]) set("canonicalUrl", decode(canonical[1]), "Page source");
      set("price", metaContent(html, "product:price:amount") || metaContent(html, "og:price:amount"), "Open Graph");
      set("salePrice", metaContent(html, "product:sale_price:amount"), "Open Graph");
      set(
        "currency",
        metaContent(html, "product:price:currency") || metaContent(html, "og:price:currency"),
        "Open Graph",
      );
      set("availability", metaContent(html, "product:availability"), "Open Graph");
      set("sku", metaContent(html, "product:retailer_item_id"), "Open Graph");
      set("category", metaContent(html, "product:category") || metaContent(html, "article:section"), "Open Graph");
      const keywordMeta = metaContent(html, "keywords");
      if (keywordMeta && !result.tags.length)
        result.tags = keywordMeta.split(",").map((k) => k.trim()).filter(Boolean);

      for (const key of ["og:image", "og:image:secure_url", "twitter:image", "twitter:image:src"]) {
        for (const img of metaAll(html, key)) addImage(img, "Open Graph");
      }
      log.push({ step: "Metadata checked", status: "Complete", detail: `${Object.keys(result.fields).length} field(s) so far.` });

      if (!result.fields.title) {
        const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
        if (t?.[1]) set("title", stripTags(t[1]), "Page title");
      }

      /* ---------- JSON-LD structured data ---------- */
      const nodes = flatten(jsonLdBlocks(html));
      const product = nodes.find((n) => hasType(n, "product"));

      if (product) {
        log.push({ step: "Structured data checked", status: "Complete", detail: "Product block found." });
        set("title", product["name"], "Structured data");
        set("brand", product["brand"], "Structured data");
        set("sku", product["sku"] ?? product["mpn"] ?? product["gtin13"], "Structured data");
        set("listingId", product["productID"] ?? product["@id"], "Structured data");
        set("category", product["category"], "Structured data");
        set("materials", product["material"], "Structured data");
        set("size", product["size"], "Structured data");
        set("productType", product["additionalType"], "Structured data");
        set("metalColor", product["color"], "Structured data");
        const desc = asString(product["description"]);
        if (desc) set("description", stripTags(desc), "Structured data");

        const offers = product["offers"];
        const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
        const offer = offerList[0] as Record<string, unknown> | undefined;
        if (offer && typeof offer === "object") {
          set("price", offer["price"] ?? offer["lowPrice"], "Structured data");
          set("salePrice", offer["highPrice"], "Structured data");
          set("currency", offer["priceCurrency"], "Structured data");
          set("availability", asString(offer["availability"]).split("/").pop() ?? "", "Structured data");
          set("seller", offer["seller"], "Structured data");
          const shipping = offer["shippingDetails"];
          if (shipping) set("shipping", asString(shipping), "Structured data");
        }

        const rating = product["aggregateRating"] as Record<string, unknown> | undefined;
        if (rating && typeof rating === "object") {
          set("rating", rating["ratingValue"], "Structured data");
          set("reviewCount", rating["reviewCount"] ?? rating["ratingCount"], "Structured data");
        }

        const props = product["additionalProperty"];
        if (Array.isArray(props)) {
          const pairs = props
            .map((p) => {
              const o = p as Record<string, unknown>;
              const name = asString(o["name"]);
              const value = asString(o["value"]);
              return name && value ? `${name}: ${value}` : "";
            })
            .filter(Boolean);
          if (pairs.length) set("options", pairs.join(" | "), "Structured data");
        }

        const image = product["image"];
        const imgs = Array.isArray(image) ? image : image ? [image] : [];
        for (const i of imgs) addImage(typeof i === "string" ? i : asString(i), "Structured data");

        const keywords = product["keywords"];
        if (typeof keywords === "string" && !result.tags.length)
          result.tags = keywords.split(",").map((k) => k.trim()).filter(Boolean);
        else if (Array.isArray(keywords) && !result.tags.length) result.tags = keywords.map(asString).filter(Boolean);
      } else {
        log.push({ step: "Structured data checked", status: "Partial", detail: "No product block on the page." });
      }

      // Breadcrumb path -> category / subcategory
      const crumbNode = nodes.find((n) => hasType(n, "breadcrumb"));
      if (crumbNode && Array.isArray(crumbNode["itemListElement"])) {
        const names = (crumbNode["itemListElement"] as unknown[])
          .map((e) => {
            const o = e as Record<string, unknown>;
            return asString(o["name"] ?? o["item"]);
          })
          .filter(Boolean);
        if (names.length) {
          set("breadcrumb", names.join(" › "), "Structured data");
          if (names.length > 1) set("category", names[1], "Structured data");
          if (names.length > 2) set("subcategory", names[2], "Structured data");
        }
      }

      const org = nodes.find((n) => hasType(n, "organization") || hasType(n, "store"));
      if (org) {
        set("seller", org["name"], "Structured data");
        set("shopUrl", org["url"], "Structured data");
      }

      /* ---------- Embedded data objects ---------- */
      const embedded = [
        /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
        /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/i,
        /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/i,
        /<script[^>]+type=["']application\/json["'][^>]*id=["'][^"']*[Pp]roduct[^"']*["'][^>]*>([\s\S]*?)<\/script>/i,
      ];
      for (const re of embedded) {
        const m = re.exec(html);
        if (!m?.[1]) continue;
        try {
          const blob = JSON.parse(m[1].trim()) as unknown;
          const flatNodes = flatten([blob]);
          const p = flatNodes.find((n) => n["price"] !== undefined && (n["title"] !== undefined || n["name"] !== undefined));
          if (p) {
            log.push({ step: "Page data checked", status: "Complete", detail: "Embedded product data read." });
            set("title", p["title"] ?? p["name"], "Page data");
            set("price", p["price"], "Page data");
            set("currency", p["currency_code"] ?? p["currency"], "Page data");
            set("sku", p["sku"], "Page data");
            set("listingId", p["id"] ?? p["listing_id"], "Page data");
          }
          for (const n of flatNodes) {
            const u = asString(n["url"] ?? n["src"] ?? n["image_url"]);
            if (/^https?:.+\.(?:jpe?g|png|webp)/i.test(u)) addImage(u, "Page data");
          }
        } catch {
          /* ignore */
        }
      }

      /* ---------- Visible HTML ---------- */
      if (!result.fields.title) {
        const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
        if (h1?.[1]) set("title", stripTags(h1[1]), "Page HTML");
      }
      if (!result.fields.price) {
        const priceEl =
          /<[^>]+class=["'][^"']*(?:price|amount)[^"']*["'][^>]*>([\s\S]{0,120}?)<\//i.exec(html);
        const priceTxt = priceEl ? stripTags(priceEl[1]!) : "";
        const num = /([£$€₹¥])?\s?([0-9][0-9.,]{0,10})/.exec(priceTxt);
        if (num?.[2]) {
          set("price", num[2].replace(/,(?=\d{3}\b)/g, ""), "Page HTML");
          if (num[1]) set("currency", num[1], "Page HTML");
        }
      }
      if (!result.fields.breadcrumb) {
        const nav = /<(?:nav|ol|ul)[^>]+(?:class|id)=["'][^"']*breadcrumb[^"']*["'][^>]*>([\s\S]*?)<\/(?:nav|ol|ul)>/i.exec(html);
        if (nav?.[1]) {
          const parts = stripTags(nav[1]).split(/\s{2,}|›|»|\/|>/).map((s) => s.trim()).filter(Boolean);
          if (parts.length) set("breadcrumb", parts.join(" › "), "Page HTML");
        }
      }

      // Gallery images from the markup itself
      const imgRe = /<img[^>]+(?:data-src|data-srcset|srcset|src)=["']([^"']+)["']/gi;
      let im: RegExpExecArray | null;
      while ((im = imgRe.exec(html)) && result.images.length < 40) {
        const first = im[1]!.split(",")[0]!.trim().split(" ")[0]!;
        if (/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(first)) addImage(first, "Page HTML");
      }

      // Etsy image CDN fallback — listing photos are plain URLs in the markup.
      if (isEtsy) {
        const re = /https:\/\/i\.etsystatic\.com\/[^\s"'\\<>]+?\.(?:jpg|jpeg|png|webp)/gi;
        for (const m of html.match(re) ?? []) {
          if (/il_(?:75|100|170|180)x/.test(m)) continue;
          addImage(m, "Etsy images");
          if (result.images.length > 30) break;
        }
        const shop = /https:\/\/www\.etsy\.com\/shop\/[A-Za-z0-9_-]+/i.exec(html);
        if (shop?.[0]) set("shopUrl", shop[0], "Page HTML");
      }

      log.push({ step: "Page source parsed", status: "Complete", detail: `${result.images.length} image link(s) collected.` });

      /* ---------- Jewellery attribute reading (from the page's own words) ---------- */
      const corpus = `${result.fields.title?.value ?? ""} ${result.fields.description?.value ?? ""} ${result.tags.join(" ")}`;
      for (const { key, re } of JEWELLERY_PATTERNS) {
        const m = re.exec(corpus);
        if (m) set(key, decode(m[0]), "Read from description");
      }
    }

    /* ---------- Etsy oEmbed fallback ---------- */
    if (isEtsy && (!result.fields.title || result.images.length === 0)) {
      const o = await etsyOembed(data.url);
      if (o) {
        log.push({ step: "Etsy summary", status: "Complete", detail: "Basic listing details read from Etsy." });
        set("title", o.title ?? "", "Etsy summary");
        set("brand", o.author_name ?? "", "Etsy summary");
        set("seller", o.author_name ?? "", "Etsy summary");
        set("shopUrl", o.author_url ?? "", "Etsy summary");
        if (o.thumbnail_url) addImage(o.thumbnail_url, "Etsy summary");
      } else {
        log.push({ step: "Etsy summary", status: "Failed", detail: "Etsy did not answer the summary request." });
      }
    }

    /* ---------- From the link itself ---------- */
    const idMatch = /\/(?:listing|dp|itm|products?|pin)\/([A-Za-z0-9-]+)/i.exec(data.url);
    if (idMatch?.[1]) {
      set("listingId", idMatch[1], "Link");
      set("sku", idMatch[1], "Link");
    }
    if (host) set("platform", isPinterest ? "Pinterest" : isEtsy ? "Etsy" : host, "Link");
    set("canonicalUrl", data.url, "Link");

    /* ---------- De-duplicate images ---------- */
    const seen = new Set<string>();
    result.images = result.images.filter((i) => {
      const key = i.url.split("?")[0]!;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    result.tags = Array.from(new Set(result.tags.map((t) => t.trim()).filter(Boolean))).slice(0, 40);

    const meaningful = (
      ["title", "brand", "price", "description", "sku", "category", "materials"] as FieldKey[]
    ).filter((k) => result.fields[k]?.value).length;
    const found = Object.keys(result.fields).length;

    log.push({
      step: "Fields collected",
      status: meaningful ? "Complete" : "Failed",
      detail: `${found} field(s), ${result.images.length} image(s), ${result.tags.length} tag(s).`,
    });

    const ok = meaningful > 0 || result.images.length > 0;
    const out: FetchResult = {
      ok,
      message: ok
        ? `Read ${found} field(s) and ${result.images.length} image(s) from the page.`
        : "This shop blocked every read. Paste the page text, or fill the details in by hand.",
      log,
      data: result,
    };

    if (ok && !data.html) cache.set(data.url, { at: Date.now(), result: out });
    return out;
  });
