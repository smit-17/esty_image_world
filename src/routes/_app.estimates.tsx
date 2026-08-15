import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Search, Loader2, Check, ImageOff, Clock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchCategories,
  fetchEstimates,
  fetchImages,
  fetchProducts,
  saveEstimate,
  signPaths,
  type DiamondRow,
  type Product,
  type ProductEstimate,
} from "@/lib/lepdo";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "@/components/ImageLightbox";

export const Route = createFileRoute("/_app/estimates")({
  head: () => ({
    meta: [
      { title: "Metal & Diamond Estimate — LEPDO Lifestyle" },
      {
        name: "description",
        content:
          "Record 14KT gold weight and diamond weights per product with fast bulk entry for the LEPDO jewelry library.",
      },
      { property: "og:title", content: "Metal & Diamond Estimate — LEPDO Lifestyle" },
      {
        property: "og:description",
        content: "Track gold grams and diamond carats for every LEPDO product.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EstimatesPage,
});

const ALL = "__all__";

const QUICK_FILTERS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today Listed" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "recent", label: "Recent" },
  { value: "saved", label: "Saved" },
  { value: "pending", label: "Unsaved / Pending" },
] as const;

type QuickFilter = (typeof QUICK_FILTERS)[number]["value"];

const newRow = (): DiamondRow => ({
  id: Math.random().toString(36).slice(2),
  weight: "",
  note: "",
});

function toNum(v: string) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function isComplete(e?: ProductEstimate) {
  if (!e) return false;
  const total = (e.diamonds ?? []).reduce((s, r) => s + toNum(String(r.weight ?? "")), 0);
  return Number(e.gold_weight) > 0 || total > 0;
}

function EstimatesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [category, setCategory] = useState(ALL);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });
  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates"],
    queryFn: fetchEstimates,
  });
  const { data: images = [] } = useQuery({
    queryKey: ["images", "all"],
    queryFn: () => fetchImages(),
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const byProduct = useMemo(() => {
    const map: Record<string, ProductEstimate> = {};
    for (const e of estimates) map[e.product_id] = e;
    return map;
  }, [estimates]);

  // Main/first image per product — full resolution so weights can be judged.
  const coverByProduct = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of products) {
      const own = images.filter((i) => i.product_id === p.id);
      const cover = own.find((i) => i.path === p.cover_url) ?? own[0];
      if (cover) map[p.id] = cover.path;
      else if (p.cover_url) map[p.id] = p.cover_url;
    }
    return map;
  }, [products, images]);

  const coverPaths = Object.values(coverByProduct);
  const { data: signed = {} } = useQuery({
    queryKey: ["signed", coverPaths.join(",")],
    queryFn: () => signPaths(coverPaths),
    enabled: coverPaths.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });

  const matchesQuick = (p: (typeof products)[number], q: QuickFilter) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const created = new Date(p.created_at).getTime();
    const done = isComplete(byProduct[p.id]);
    switch (q) {
      case "today":
        return created >= startOfDay;
      case "week":
        return now.getTime() - created <= 7 * 86400000;
      case "month":
        return now.getTime() - created <= 30 * 86400000;
      case "recent":
        return now.getTime() - created <= 3 * 86400000;
      case "saved":
        return done;
      case "pending":
        return !done;
      default:
        return true;
    }
  };

  const base = useMemo(
    () =>
      products.filter((p) => {
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (category !== ALL && p.category !== category) return false;
        return true;
      }),
    [products, search, category],
  );

  const filtered = useMemo(
    () => base.filter((p) => matchesQuick(p, quick)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, quick, byProduct],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of QUICK_FILTERS) map[f.value] = base.filter((p) => matchesQuick(p, f.value)).length;
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, byProduct]);

  const savedCount = products.filter((p) => isComplete(byProduct[p.id])).length;

  // Lightbox — stays on this page, no navigation, no scroll reset.
  const [viewer, setViewer] = useState<{ productId: string; index: number } | null>(null);
  const viewerProduct = products.find((p) => p.id === viewer?.productId);
  const viewerPaths = useMemo(() => {
    if (!viewer) return [] as string[];
    const own = images.filter((i) => i.product_id === viewer.productId);
    const cover = viewerProduct?.cover_url;
    const sorted = [...own].sort((a, b) =>
      a.path === cover ? -1 : b.path === cover ? 1 : 0,
    );
    const paths = sorted.map((i) => i.path);
    return paths.length ? paths : cover ? [cover] : [];
  }, [viewer, images, viewerProduct]);

  const { data: viewerSigned = {} } = useQuery({
    queryKey: ["signed", "viewer", viewerPaths.join(",")],
    queryFn: () => signPaths(viewerPaths),
    enabled: viewerPaths.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });
  const viewerUrls = viewerPaths.map((p) => viewerSigned[p]).filter(Boolean) as string[];



  return (
    <div className="space-y-6">
      <header className="min-w-0">
        <p className="text-eyebrow">Estimates</p>
        <h1 className="mt-1 text-3xl text-primary lg:text-4xl">Metal &amp; Diamond Estimate</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {savedCount} saved · {products.length - savedCount} pending of {products.length} products
        </p>
      </header>

      <div className="surface space-y-3 p-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products"
              className="h-11 rounded-xl pl-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setQuick(f.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                quick === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-primary",
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.65rem] leading-none lining-nums tabular-nums",
                  quick === f.value ? "bg-primary-foreground/20" : "bg-muted text-foreground/70",
                )}
              >
                {counts[f.value] ?? 0}
              </span>

            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="surface aspect-[3/4] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface px-6 py-16 text-center text-sm text-muted-foreground">
          No products found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <EstimateCard
              key={p.id}
              product={p}
              cover={signed[coverByProduct[p.id] ?? ""]}
              estimate={byProduct[p.id]}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ["estimates"] })}
              onOpenImages={() => setViewer({ productId: p.id, index: 0 })}
            />
          ))}
        </div>
      )}

      {viewer && viewerUrls.length > 0 && (
        <ImageLightbox
          urls={viewerUrls}
          index={Math.min(viewer.index, viewerUrls.length - 1)}
          title={viewerProduct?.name}
          onIndexChange={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

function EstimateCard({
  product,
  cover,
  estimate,
  onSaved,
  onOpenImages,
}: {
  product: Product;
  cover?: string;
  estimate?: ProductEstimate;
  onSaved: () => void;
  onOpenImages: () => void;
}) {
  const [gold, setGold] = useState(estimate?.gold_weight ? String(estimate.gold_weight) : "");
  const [rows, setRows] = useState<DiamondRow[]>(
    estimate?.diamonds?.length ? estimate.diamonds : [newRow()],
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Keep the card in sync when the saved record refreshes and the user isn't editing.
  useEffect(() => {
    if (dirty || !estimate) return;
    setGold(estimate.gold_weight ? String(estimate.gold_weight) : "");
    setRows(estimate.diamonds?.length ? estimate.diamonds : [newRow()]);
  }, [estimate, dirty]);

  const total = rows.reduce((sum, r) => sum + toNum(r.weight), 0);
  const done = isComplete(estimate);

  function update(id: string, patch: Partial<DiamondRow>) {
    setDirty(true);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function save() {
    setSaving(true);
    try {
      await saveEstimate(
        product.id,
        toNum(gold),
        rows.filter((r) => r.weight.trim() || r.note.trim()),
      );
      setDirty(false);
      onSaved();
      toast.success(`Saved · ${product.name}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface flex min-w-0 flex-col overflow-hidden">
      <button type="button" onClick={onOpenImages} className="block w-full text-left">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {cover ? (
            <img
              src={cover}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-6" strokeWidth={1.5} />
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-primary">
            {product.category}
          </span>
        </div>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
        <header className="min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 flex-1 truncate text-base leading-snug">{product.name}</h2>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                done
                  ? "bg-primary text-primary-foreground"
                  : "bg-gold/20 text-primary ring-1 ring-gold/50",
              )}
            >
              {done ? <Check className="size-3.5" /> : <Clock className="size-3.5" />}
              {done ? "Saved" : "Pending"}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {product.category} · Uploaded by {product.team_member}
          </p>
        </header>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">14KT Gold Weight (gm)</span>
          <Input
            inputMode="decimal"
            value={gold}
            onChange={(e) => {
              setGold(e.target.value);
              setDirty(true);
            }}
            placeholder="0.00"
            className="h-11 rounded-xl tabular-nums"
          />
        </label>

        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Diamond Weight (ct)</span>
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[minmax(0,5rem)_minmax(0,1fr)_auto] gap-2">
              <Input
                inputMode="decimal"
                value={r.weight}
                onChange={(e) => update(r.id, { weight: e.target.value })}
                placeholder="ct"
                className="h-11 rounded-xl tabular-nums"
                aria-label="Diamond weight in carats"
              />
              <Input
                value={r.note}
                onChange={(e) => update(r.id, { note: e.target.value })}
                placeholder="Size / details"
                className="h-11 min-w-0 rounded-xl"
                aria-label="Diamond note"
              />
              <Button
                type="button"
                variant="outline"
                className="size-11 shrink-0 rounded-xl text-destructive hover:text-destructive"
                onClick={() => {
                  setDirty(true);
                  setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : [newRow()]));
                }}
                aria-label="Remove diamond row"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="h-10 w-full rounded-xl"
            onClick={() => setRows((rs) => [...rs, newRow()])}
          >
            <Plus className="size-4" /> Add Diamond
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Total Diamond Weight</span>
          <span className="text-sm tabular-nums">{total.toFixed(3)} ct</span>
        </div>

        <Button onClick={save} disabled={saving} className="mt-auto h-11 w-full rounded-full">
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : !dirty && done ? (
            <Check className="size-4" />
          ) : null}
          {estimate ? "Update" : "Save"}
        </Button>
      </div>
    </section>
  );
}
