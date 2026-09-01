import type { Product, ProductEstimate } from "@/lib/lepdo";

export const ANY = "__any__";

/* ---------------- option lists (shared by forms + filters) ---------------- */

export const PRODUCT_TYPES = [
  "Fine Jewelry",
  "Fashion Jewelry",
  "Bridal",
  "Everyday",
  "Statement",
  "Custom",
] as const;

export const SUBCATEGORIES = [
  "Solitaire",
  "Halo",
  "Eternity",
  "Stud",
  "Hoop",
  "Drop",
  "Pendant",
  "Chain",
  "Tennis",
  "Bangle",
  "Cuff",
  "Band",
] as const;

export const METAL_TYPES = ["Gold", "Silver", "Platinum"] as const;
export const METAL_KARATS = ["9KT", "10KT", "14KT", "18KT"] as const;
export const METAL_COLOURS = ["Yellow", "White", "Rose"] as const;
export const DIAMOND_TYPES = ["Lab Grown", "Moissanite"] as const;
export const DIAMOND_SHAPES = [
  "Round",
  "Oval",
  "Pear",
  "Marquise",
  "Emerald",
  "Princess",
  "Cushion",
  "Radiant",
  "Baguette",
  "Heart",
] as const;
export const DIAMOND_COLOURS = ["D", "E", "F", "G", "H", "I", "J", "K"] as const;
export const DIAMOND_CLARITIES = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2"] as const;

export const LISTING_STATUSES = [
  { value: "listed", label: "Listed (any)" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Draft" },
  { value: "not_listed", label: "Not Listed" },
  { value: "sold_out", label: "Sold Out" },
  { value: "deactivated", label: "Deactivated" },
] as const;

export const QC_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "PASS", label: "Pass" },
  { value: "HOLD", label: "Hold" },
  { value: "REJECT", label: "Reject" },
] as const;

export const WEIGHT_OPTIONS = [
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
] as const;


export const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
] as const;

export const SORTS = [
  { value: "sku_asc", label: "SKU: 1 → 100" },
  { value: "sku_desc", label: "SKU: 100 → 1" },
  { value: "sku_az", label: "SKU: A → Z" },
  { value: "sku_za", label: "SKU: Z → A" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "category", label: "Category" },
  { value: "updated", label: "Recently Updated" },
] as const;

export type SortKey = (typeof SORTS)[number]["value"];

/** Natural comparison: RING-1 < RING-2 < RING-10, and 1 < 2 < 10 < 100. */
export function naturalCompare(a: string, b: string) {
  return (a || "").localeCompare(b || "", undefined, { numeric: true, sensitivity: "base" });
}


/* ---------------- filter state ---------------- */

export type Filters = {
  q: string;
  date: string; // ANY | today | yesterday | 7 | 30 | custom
  from: string;
  to: string;
  category: string;
  subcategory: string;
  productType: string;
  sku: string;
  member: string[];
  listing: string[];
  qc: string[];
  weight: string[]; // completed | pending
  metalType: string;
  metalKarat: string;
  metalColour: string;
  diamondType: string;
  diamondShape: string;
  diamondColour: string;
  diamondClarity: string;
  caratMin: string;
  caratMax: string;
  goldMin: string;
  goldMax: string;
  imagesMin: string;
  imagesMax: string;
  sort: SortKey;
};

export const EMPTY_FILTERS: Filters = {
  q: "",
  date: ANY,
  from: "",
  to: "",
  category: ANY,
  subcategory: ANY,
  productType: ANY,
  sku: "",
  member: [],
  listing: [],
  qc: [],
  weight: [],
  metalType: ANY,
  metalKarat: ANY,
  metalColour: ANY,
  diamondType: ANY,
  diamondShape: ANY,
  diamondColour: ANY,
  diamondClarity: ANY,
  caratMin: "",
  caratMax: "",
  goldMin: "",
  goldMax: "",
  imagesMin: "",
  imagesMax: "",
  sort: "newest",
};

export const MULTI_KEYS = ["member", "listing", "qc", "weight"] as const;
export type MultiKey = (typeof MULTI_KEYS)[number];

export function toggleMulti(f: Filters, key: MultiKey, value: string): Filters {
  const cur = f[key] ?? [];
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  return { ...f, [key]: next };
}

const LABELS: Partial<Record<keyof Filters, string>> = {
  q: "Search",
  date: "Date",
  category: "Category",
  subcategory: "Subcategory",
  productType: "Type",
  sku: "SKU",
  member: "Created by",
  listing: "Listing",
  qc: "QC",
  weight: "Weight",
  metalType: "Metal",
  metalKarat: "Karat",
  metalColour: "Metal colour",
  diamondType: "Diamond",
  diamondShape: "Shape",
  diamondColour: "Diamond colour",
  diamondClarity: "Clarity",
  caratMin: "Carat min",
  caratMax: "Carat max",
  goldMin: "Metal wt min",
  goldMax: "Metal wt max",
  imagesMin: "Images min",
  imagesMax: "Images max",
};

export type Chip = { key: keyof Filters; label: string; value: string; item?: string };

export function activeChips(f: Filters): Chip[] {
  const chips: Chip[] = [];
  (Object.keys(LABELS) as (keyof Filters)[]).forEach((key) => {
    const raw = f[key];
    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        let text = item;
        if (key === "listing") text = LISTING_STATUSES.find((s) => s.value === item)?.label ?? item;
        if (key === "qc") text = QC_OPTIONS.find((s) => s.value === item)?.label ?? item;
        if (key === "weight") text = WEIGHT_OPTIONS.find((s) => s.value === item)?.label ?? item;
        chips.push({ key, label: LABELS[key]!, value: text, item });
      });
      return;
    }
    const v = String(raw ?? "");
    if (!v || v === ANY) return;
    let text = v;
    if (key === "date") {
      text =
        v === "custom"
          ? `${f.from || "…"} → ${f.to || "…"}`
          : (DATE_PRESETS.find((d) => d.value === v)?.label ?? v);
    }
    chips.push({ key, label: LABELS[key]!, value: text });
  });
  return chips;
}

export function clearChip(f: Filters, key: keyof Filters, item?: string): Filters {
  if (item && Array.isArray(f[key])) {
    return { ...f, [key]: (f[key] as string[]).filter((v) => v !== item) } as Filters;
  }
  const next = { ...f, [key]: EMPTY_FILTERS[key] } as Filters;
  if (key === "date") {
    next.from = "";
    next.to = "";
  }
  return next;
}

export function countActive(f: Filters): number {
  return activeChips(f).length;
}


/* ---------------- filtering engine ---------------- */

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export function estimateSummary(e?: ProductEstimate) {
  const rows = e?.diamonds ?? [];
  const carat = rows.reduce((s, r) => s + num(r.weight), 0);
  const gold = num(e?.gold_weight);
  return { gold, carat, rows, complete: gold > 0 || carat > 0 };
}

function inDateRange(iso: string, f: Filters) {
  if (f.date === ANY) return true;
  const t = new Date(iso).getTime();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (f.date) {
    case "today":
      return t >= startToday;
    case "yesterday":
      return t >= startToday - 86400000 && t < startToday;
    case "7":
      return t >= startToday - 6 * 86400000;
    case "30":
      return t >= startToday - 29 * 86400000;
    case "custom": {
      const from = f.from ? new Date(`${f.from}T00:00:00`).getTime() : -Infinity;
      const to = f.to ? new Date(`${f.to}T23:59:59`).getTime() : Infinity;
      return t >= from && t <= to;
    }
    default:
      return true;
  }
}

function within(value: number, min: string, max: string) {
  if (min !== "" && value < num(min)) return false;
  if (max !== "" && value > num(max)) return false;
  return true;
}

export type FilterContext = {
  estimateByProduct: Record<string, ProductEstimate | undefined>;
  imageCountByProduct: Record<string, number>;
};

export function applyFilters(products: Product[], f: Filters, ctx: FilterContext): Product[] {
  const q = f.q.trim().toLowerCase();
  const sku = f.sku.trim().toLowerCase();

  const list = products.filter((p) => {
    const est = ctx.estimateByProduct[p.id];
    const { gold, carat, rows, complete } = estimateSummary(est);

    if (q) {
      const hay = [p.name, p.sku, p.id, p.category, p.subcategory, p.product_type, p.notes, p.team_member]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (sku && !(p.sku ?? "").toLowerCase().includes(sku)) return false;
    if (!inDateRange(p.created_at, f)) return false;
    if (f.category !== ANY && p.category !== f.category) return false;
    if (f.subcategory !== ANY && (p.subcategory ?? "") !== f.subcategory) return false;
    if (f.productType !== ANY && (p.product_type ?? "") !== f.productType) return false;
    if (f.member.length && !f.member.includes(p.team_member)) return false;

    if (f.listing.length) {
      const status = p.etsy_status ?? "not_listed";
      const ok = f.listing.some((sel) =>
        sel === "listed" ? status !== "not_listed" : status === sel,
      );
      if (!ok) return false;
    }
    if (f.qc.length && !f.qc.includes((p.qc_status ?? "PENDING").toUpperCase())) return false;
    if (f.weight.length) {
      const ok = f.weight.some((sel) => (sel === "completed" ? complete : !complete));
      if (!ok) return false;
    }


    if (f.metalType !== ANY && (est?.metal_type ?? "") !== f.metalType) return false;
    if (f.metalKarat !== ANY && (est?.metal_karat ?? "") !== f.metalKarat) return false;
    if (f.metalColour !== ANY && (est?.metal_colour ?? "") !== f.metalColour) return false;
    if (f.diamondType !== ANY && (est?.diamond_type ?? "") !== f.diamondType) return false;

    if (f.diamondShape !== ANY && !rows.some((r) => r.shape === f.diamondShape)) return false;
    if (f.diamondColour !== ANY && !rows.some((r) => r.colour === f.diamondColour)) return false;
    if (f.diamondClarity !== ANY && !rows.some((r) => r.clarity === f.diamondClarity)) return false;

    if (!within(carat, f.caratMin, f.caratMax)) return false;
    if (!within(gold, f.goldMin, f.goldMax)) return false;
    if (!within(ctx.imageCountByProduct[p.id] ?? 0, f.imagesMin, f.imagesMax)) return false;

    return true;
  });

  const sorted = [...list];
  const skuOf = (p: Product) => (p.sku ?? "").trim();
  sorted.sort((a, b) => {
    switch (f.sort) {
      case "oldest":
        return +new Date(a.created_at) - +new Date(b.created_at);
      case "sku_asc":
      case "sku_desc":
      case "sku_az":
      case "sku_za": {
        const x = skuOf(a);
        const y = skuOf(b);
        if (!x !== !y) return x ? -1 : 1; // blanks last
        const alpha = f.sort === "sku_az" || f.sort === "sku_za";
        const cmp = alpha
          ? x.localeCompare(y, undefined, { sensitivity: "base" })
          : naturalCompare(x, y);
        const dir = f.sort === "sku_desc" || f.sort === "sku_za" ? -1 : 1;
        return dir * (cmp || naturalCompare(a.name, b.name));
      }
      case "category":
        return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      case "updated":
        return +new Date(b.updated_at) - +new Date(a.updated_at);
      default:
        return +new Date(b.created_at) - +new Date(a.created_at);
    }
  });

  return sorted;
}

/* ---------------- saved presets ---------------- */

export type Preset = { id: string; name: string; filters: Filters };

const key = (scope: string) => `lepdo:filter-presets:${scope}`;

export function loadPresets(scope: string): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(scope));
    return raw ? (JSON.parse(raw) as Preset[]) : [];
  } catch {
    return [];
  }
}

export function savePresets(scope: string, presets: Preset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(scope), JSON.stringify(presets));
}

/* ---------------- session state (survives product detail round-trip) ---------------- */

type ViewState = { filters: Filters; scrollY: number; count?: number };
const viewState = new Map<string, ViewState>();

export function rememberView(scope: string, state: ViewState) {
  viewState.set(scope, state);
}

export function recallView(scope: string): ViewState | undefined {
  return viewState.get(scope);
}
