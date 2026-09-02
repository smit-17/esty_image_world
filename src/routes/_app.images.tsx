import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ImageLightbox } from "@/components/ImageLightbox";
import { useIncremental } from "@/hooks/useIncremental";
import { cn } from "@/lib/utils";
import {
  fetchCategories,
  fetchImages,
  fetchProducts,
  fetchTeam,
  qcLabel,
  signPaths,
  type Product,
  type ProductImage,
} from "@/lib/lepdo";

export const Route = createFileRoute("/_app/images")({
  head: () => ({
    meta: [
      { title: "All Images — LEPDO Lifestyle" },
      {
        name: "description",
        content:
          "Browse every jewelry image uploaded across all LEPDO products in one fast master image library.",
      },
      { property: "og:title", content: "All Images — LEPDO Lifestyle" },
      {
        property: "og:description",
        content: "A fast master library of every product image with search, filters and quick preview.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AllImagesPage,
});

type SortKey = "newest" | "oldest" | "sku_asc" | "sku_desc";

type State = {
  q: string;
  cat: string;
  team: string;
  date: string;
  qc: string;
  sort: SortKey;
};

const DEFAULT_STATE: State = {
  q: "",
  cat: "all",
  team: "all",
  date: "all",
  qc: "all",
  sort: "newest",
};

const STORE_KEY = "lepdo.allimages.state";
const SCROLL_KEY = "lepdo.allimages.scroll";

function readState(): State {
  if (typeof sessionStorage === "undefined") return DEFAULT_STATE;
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<State>) } : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

/** Natural SKU compare so KRISHA-2 sorts before KRISHA-10. */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function sinceFor(key: string): number | null {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  if (key === "today") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d.getTime();
  }
  if (key === "7d") return now.getTime() - 7 * day;
  if (key === "30d") return now.getTime() - 30 * day;
  if (key === "90d") return now.getTime() - 90 * day;
  return null;
}

const QUICK_CATS = ["Ring", "Earring", "Necklace", "Bracelet"];

function AllImagesPage() {
  const [state, setState] = useState<State>(readState);
  const set = <K extends keyof State>(k: K, v: State[K]) => setState((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });
  const { data: images = [], isLoading: loadingImages } = useQuery({
    queryKey: ["images", "all"],
    queryFn: () => fetchImages(),
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: fetchTeam });

  const productById = useMemo(() => {
    const map: Record<string, Product> = {};
    for (const p of products) map[p.id] = p;
    return map;
  }, [products]);

  /** Flatten every product image once, keeping its position within its product. */
  const allEntries = useMemo(() => {
    const byProduct: Record<string, ProductImage[]> = {};
    for (const i of images) (byProduct[i.product_id] ??= []).push(i);
    const out: {
      image: ProductImage;
      product: Product;
      index: number;
      total: number;
      siblings: ProductImage[];
    }[] = [];
    for (const [pid, list] of Object.entries(byProduct)) {
      const product = productById[pid];
      if (!product) continue;
      list.forEach((image, index) =>
        out.push({ image, product, index, total: list.length, siblings: list }),
      );
    }
    return out;
  }, [images, productById]);

  const filtered = useMemo(() => {
    const q = state.q.trim().toLowerCase();
    const since = sinceFor(state.date);
    let list = allEntries.filter(({ image, product }) => {
      if (state.cat !== "all" && product.category !== state.cat) return false;
      if (state.team !== "all" && product.team_member !== state.team) return false;
      if (state.qc !== "all" && (image.qc_status ?? "PENDING") !== state.qc) return false;
      if (since && new Date(image.created_at).getTime() < since) return false;
      if (q) {
        const hay = `${product.sku ?? ""} ${product.name} ${product.id} ${product.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list];
    list.sort((a, b) => {
      if (state.sort === "newest")
        return new Date(b.image.created_at).getTime() - new Date(a.image.created_at).getTime();
      if (state.sort === "oldest")
        return new Date(a.image.created_at).getTime() - new Date(b.image.created_at).getTime();
      const sa = a.product.sku || a.product.name;
      const sb = b.product.sku || b.product.name;
      const cmp = collator.compare(sa, sb);
      if (cmp !== 0) return state.sort === "sku_asc" ? cmp : -cmp;
      return a.index - b.index;
    });
    return list;
  }, [allEntries, state]);

  const { visible, hasMore, sentinel } = useIncremental(filtered, 60);

  const thumbPaths = useMemo(
    () => visible.map((e) => e.image.thumb_path || e.image.path).filter(Boolean),
    [visible],
  );
  const { data: signed = {} } = useQuery({
    queryKey: ["signed", "allimages", thumbPaths.join(",")],
    queryFn: () => signPaths(thumbPaths),
    enabled: thumbPaths.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });

  // Preview across the whole filtered list so ← / → walks the library.
  const [viewer, setViewer] = useState<number | null>(null);
  const viewerWindow = useMemo(() => {
    if (viewer === null) return [] as ProductImage[];
    const entry = filtered[viewer];
    return entry ? entry.siblings : [];
  }, [viewer, filtered]);
  const viewerPaths = useMemo(() => viewerWindow.map((i) => i.path), [viewerWindow]);
  const { data: viewerSigned = {} } = useQuery({
    queryKey: ["signed", "allimages-viewer", viewerPaths.join(",")],
    queryFn: () => signPaths(viewerPaths),
    enabled: viewerPaths.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });
  const viewerUrls = viewerPaths.map((p) => viewerSigned[p]).filter(Boolean) as string[];
  const viewerEntry = viewer === null ? null : filtered[viewer];

  // Restore scroll after coming back from a product.
  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    const saved = Number(sessionStorage.getItem(SCROLL_KEY) || 0);
    if (saved > 0 && visible.length) {
      window.scrollTo({ top: saved });
      sessionStorage.removeItem(SCROLL_KEY);
    }
    // Only attempt once the first batch is mounted.
  }, [visible.length]);

  const rememberScroll = () => {
    try {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    } catch {
      /* ignore */
    }
  };

  const catOptions = useMemo(() => {
    const names = new Set<string>(categories.map((c) => c.name));
    for (const p of products) if (p.category) names.add(p.category);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [categories, products]);

  const teamOptions = useMemo(() => {
    const names = new Set<string>(team.map((t) => t.name));
    for (const p of products) if (p.team_member) names.add(p.team_member);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [team, products]);

  const loading = loadingProducts || loadingImages;

  const selectCls =
    "h-9 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground";

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl text-primary lg:text-3xl">All Images</h1>
          <span className="text-sm text-muted-foreground">
            {filtered.length.toLocaleString()} Images
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={state.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Search images / SKU / Product ID"
            className="h-9 w-full max-w-xs text-sm"
          />

          <select
            className={selectCls}
            value={state.team}
            onChange={(e) => set("team", e.target.value)}
            aria-label="Created by"
          >
            <option value="all">Created By: All</option>
            {teamOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <select
            className={selectCls}
            value={state.date}
            onChange={(e) => set("date", e.target.value)}
            aria-label="Date"
          >
            <option value="all">Date: All</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>

          <select
            className={selectCls}
            value={state.qc}
            onChange={(e) => set("qc", e.target.value)}
            aria-label="QC status"
          >
            <option value="all">QC: All</option>
            <option value="PENDING">Pending</option>
            <option value="PASS">Pass</option>
            <option value="HOLD">Hold</option>
            <option value="REJECT">Reject</option>
          </select>

          <select
            className={selectCls}
            value={state.cat}
            onChange={(e) => set("cat", e.target.value)}
            aria-label="Product category"
          >
            <option value="all">SKU / Category: All</option>
            {catOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <select
            className={selectCls}
            value={state.sort}
            onChange={(e) => set("sort", e.target.value as SortKey)}
            aria-label="Sort"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="sku_asc">SKU 1→100</option>
            <option value="sku_desc">SKU 100→1</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {["all", ...QUICK_CATS.filter((c) => catOptions.some((o) => o.toLowerCase().startsWith(c.toLowerCase())))].map(
            (c) => {
              const value =
                c === "all" ? "all" : catOptions.find((o) => o.toLowerCase().startsWith(c.toLowerCase())) ?? c;
              const active = state.cat === value;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("cat", value)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {c === "all" ? "All" : c}
                </button>
              );
            },
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading images…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-sm text-muted-foreground">
          <ImageOff className="h-5 w-5" />
          No images match these filters.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((entry, i) => {
              const key = entry.image.thumb_path || entry.image.path;
              const url = signed[key];
              return (
                <div
                  key={entry.image.id}
                  className="overflow-hidden rounded-md border border-border bg-card"
                >
                  <button
                    type="button"
                    onClick={() => setViewer(i)}
                    className="block aspect-square w-full bg-secondary"
                    aria-label="Open preview"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={`${entry.product.sku || entry.product.name} image ${entry.index + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </button>
                  <div className="space-y-1 px-2.5 py-2">
                    <p className="truncate text-sm font-semibold leading-tight text-foreground">
                      {entry.product.sku || entry.product.name}{" "}
                      <span className="font-normal text-muted-foreground">
                        • {entry.index + 1}/{entry.total}
                      </span>
                    </p>
                    <p className="truncate text-xs leading-tight text-muted-foreground">
                      {entry.product.category}
                      {entry.image.qc_status && entry.image.qc_status !== "PENDING"
                        ? ` • ${qcLabel(entry.image.qc_status)}`
                        : ""}
                    </p>
                    <Link
                      to="/products/$id"
                      params={{ id: entry.product.id }}
                      onClick={rememberScroll}
                      className="block text-xs font-semibold text-primary hover:underline"
                    >
                      Open Product →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          {hasMore ? <div ref={sentinel} className="h-10" /> : null}
        </>
      )}

      {viewerEntry && viewerUrls.length ? (
        <ImageLightbox
          urls={viewerUrls}
          index={Math.min(viewerEntry.index, viewerUrls.length - 1)}
          title={viewerEntry.product.sku || viewerEntry.product.name}
          onIndexChange={(next) => {
            setViewer((cur) => {
              if (cur === null) return cur;
              const e = filtered[cur];
              if (!e) return cur;
              const targetId = e.siblings[next]?.id;
              const idx = filtered.findIndex(
                (f) => f.product.id === e.product.id && f.image.id === targetId,
              );
              return idx >= 0 ? idx : cur;
            });
          }}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}
