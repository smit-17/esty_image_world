import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Check, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductFilterBar } from "@/components/ProductFilterBar";
import { applyFilters, EMPTY_FILTERS, type Filters } from "@/lib/filters";

import {
  fetchCategories,
  fetchTeam,
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
import { EstimateImagePreview } from "@/components/EstimateImagePreview";
import { ProductNote } from "@/components/ProductNote";
import { EstimateImageCarousel } from "@/components/EstimateImageCarousel";
import { useIncremental } from "@/hooks/useIncremental";

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

const newRow = (): DiamondRow => ({
  id: Math.random().toString(36).slice(2),
  weight: "",
  note: "",
  shape: "",
  colour: "",
  clarity: "",
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
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

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
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: fetchTeam });

  const byProduct = useMemo(() => {
    const map: Record<string, ProductEstimate> = {};
    for (const e of estimates) map[e.product_id] = e;
    return map;
  }, [estimates]);

  // Group images once (O(n)) instead of scanning the whole list per product.
  const imagesByProduct = useMemo(() => {
    const map: Record<string, typeof images> = {};
    for (const i of images) (map[i.product_id] ??= []).push(i);
    return map;
  }, [images]);

  // Main/first image per product — full resolution so weights can be judged.
  const coverByProduct = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of products) {
      const own = imagesByProduct[p.id] ?? [];
      const cover = own.find((i) => i.path === p.cover_url) ?? own[0];
      if (cover) map[p.id] = cover.path;
      else if (p.cover_url) map[p.id] = p.cover_url;
    }
    return map;
  }, [products, imagesByProduct]);

  const pathsByProduct = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of products) {
      const cover = coverByProduct[p.id];
      const paths = (imagesByProduct[p.id] ?? []).map((image) => image.path);
      map[p.id] = cover ? [cover, ...paths.filter((path) => path !== cover)] : paths;
    }
    return map;
  }, [products, imagesByProduct, coverByProduct]);

  const imageCountByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const id of Object.keys(imagesByProduct)) map[id] = imagesByProduct[id].length;
    return map;
  }, [imagesByProduct]);

  const filtered = useMemo(
    () => applyFilters(products, filters, { estimateByProduct: byProduct, imageCountByProduct }),
    [products, filters, byProduct, imageCountByProduct],
  );

  // Only mount ~12 heavy estimate cards up front, then grow while scrolling.
  const { visible, hasMore, sentinel } = useIncremental(filtered, 12);

  const coverPaths = useMemo(
    () => visible.map((p) => coverByProduct[p.id]).filter(Boolean),
    [visible, coverByProduct],
  );
  const { data: signed = {} } = useQuery({
    queryKey: ["signed", coverPaths.join(",")],
    queryFn: () => signPaths(coverPaths),
    enabled: coverPaths.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });

  const savedCount = useMemo(
    () => products.filter((p) => isComplete(byProduct[p.id])).length,
    [products, byProduct],
  );
  const totalCount = products.length;
  const pendingCount = totalCount - savedCount;
  const pct = totalCount ? (savedCount / totalCount) * 100 : 0;
  const weightSel = filters.weight[0] ?? "all";
  const setWeight = (v: "all" | "completed" | "pending") =>
    setFilters((f) => ({ ...f, weight: v === "all" ? [] : [v] }));


  // Lightbox — stays on this page, no navigation, no scroll reset.
  const [viewer, setViewer] = useState<{ productId: string; index: number } | null>(null);
  const viewerProduct = products.find((p) => p.id === viewer?.productId);
  const viewerPaths = useMemo(() => {
    if (!viewer) return [] as string[];
    return pathsByProduct[viewer.productId] ?? [];
  }, [viewer, pathsByProduct]);

  const { data: viewerSigned = {} } = useQuery({
    queryKey: ["signed", "viewer", viewerPaths.join(",")],
    queryFn: () => signPaths(viewerPaths),
    enabled: viewerPaths.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });
  const viewerUrls = viewerPaths.map((p) => viewerSigned[p]).filter(Boolean) as string[];



  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="min-w-0 space-y-3">
        <div>
          <p className="text-eyebrow">Estimates</p>
          <h1 className="mt-1 text-2xl text-primary sm:text-3xl lg:text-4xl">Metal &amp; Diamond Estimate</h1>
        </div>

        {/* Quick status tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: "All", count: totalCount },
              { key: "pending", label: "Pending", count: pendingCount },
              { key: "completed", label: "Completed", count: savedCount },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setWeight(t.key)}
              aria-pressed={weightSel === t.key}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                weightSel === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {t.label} <span className="tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Compact status cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatusCard
            label="Total Products"
            value={totalCount}
            active={weightSel === "all"}
            onClick={() => setWeight("all")}
          />
          <StatusCard
            label="Completed"
            value={savedCount}
            active={weightSel === "completed"}
            onClick={() => setWeight("completed")}
            tone="done"
          />
          <StatusCard
            label="Pending"
            value={pendingCount}
            active={weightSel === "pending"}
            onClick={() => setWeight("pending")}
            tone="pending"
          />
          <div className="surface flex flex-col justify-center gap-2 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Completion
              </span>
              <span className="text-lg font-semibold tabular-nums text-primary">
                {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[0.7rem] tabular-nums text-muted-foreground">
              {savedCount} / {totalCount} Completed
            </span>
          </div>
        </div>
      </header>


      <ProductFilterBar
        scope="estimates"
        filters={filters}
        onChange={setFilters}
        categories={categories.map((c) => c.name)}
        team={team.map((t) => t.name)}
        resultCount={filtered.length}
        totalCount={products.length}
      />

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
          {visible.map((p) => (
            <EstimateCard
              key={p.id}
              product={p}
              cover={signed[coverByProduct[p.id] ?? ""]}
              imagePaths={pathsByProduct[p.id] ?? []}
              estimate={byProduct[p.id]}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ["estimates"] })}
              onOpenImages={(index) => setViewer({ productId: p.id, index })}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={sentinel} className="py-6 text-center text-xs text-muted-foreground">
          Loading more products…
        </div>
      )}

      {viewer && viewerUrls.length > 0 && (
        <EstimateImagePreview
          urls={viewerUrls}
          index={Math.min(viewer.index, viewerUrls.length - 1)}
          title={viewerProduct?.sku || viewerProduct?.name}
          onIndexChange={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

/** Big, clickable status tile that drives the weight-status filter. */
function StatusCard({
  label,
  value,
  active,
  onClick,
  tone = "neutral",
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  tone?: "neutral" | "done" | "pending";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "surface px-4 py-3 text-left transition hover:shadow-md",
        active && "ring-2 ring-primary",
        tone === "done" && "bg-primary/5",
        tone === "pending" && "bg-gold/10",
      )}
    >
      <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 block text-2xl font-semibold tabular-nums text-primary lg:text-3xl">
        {value}
      </span>
    </button>
  );
}

function EstimateCard({

  product,
  cover,
  imagePaths,
  estimate,
  onSaved,
  onOpenImages,
}: {
  product: Product;
  cover?: string;
  imagePaths: string[];
  estimate?: ProductEstimate;
  onSaved: () => void;
  onOpenImages: (index: number) => void;
}) {
  const initialRows = (e?: ProductEstimate): DiamondRow[] => {
    const rows = (e?.diamonds ?? []).filter((r) => r);
    return rows.length ? rows.map((r) => ({ ...newRow(), ...r })) : [newRow()];
  };
  const [gold, setGold] = useState(estimate?.gold_weight ? String(estimate.gold_weight) : "");
  const [rows, setRows] = useState<DiamondRow[]>(initialRows(estimate));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    if (dirty) setSavedFeedback(false);
  }, [dirty]);

  // Keep the card in sync when the saved record refreshes and the user isn't editing.
  useEffect(() => {
    if (dirty || !estimate) return;
    setGold(estimate.gold_weight ? String(estimate.gold_weight) : "");
    setRows(initialRows(estimate));
  }, [estimate, dirty]);

  const totalDiamond = rows.reduce((s, r) => s + toNum(r.weight), 0);
  const done = isComplete(estimate);

  const onlyNum = (v: string) => v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

  function updateRow(id: string, patch: Partial<DiamondRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const clean = rows.filter((r) => toNum(r.weight) > 0 || r.note.trim());
      await saveEstimate(product.id, toNum(gold), clean, {
        metal_type: estimate?.metal_type ?? null,
        metal_karat: estimate?.metal_karat ?? null,
        metal_colour: estimate?.metal_colour ?? null,
        diamond_type: estimate?.diamond_type ?? null,
      });
      setDirty(false);
      setSavedFeedback(true);
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
      <EstimateImageCarousel paths={imagePaths} cover={cover} title={product.sku || product.name} category={product.category} onOpen={onOpenImages} />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3 sm:gap-3 sm:p-4">
        <header className="min-w-0 space-y-1.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:flex sm:justify-between">
            <h2 className="min-w-0 flex-1 truncate text-sm leading-snug sm:text-base" title={product.name}>{product.sku || product.name}</h2>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold sm:gap-1.5 sm:px-3 sm:py-1.5",
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

        <ProductNote note={product.notes} />


        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">14KT Gold Weight (gm)</span>
          <Input
            inputMode="decimal"
            value={gold}
            onChange={(e) => {
              setGold(onlyNum(e.target.value));
              setDirty(true);
            }}
            placeholder="3.25"
            aria-label="14KT Gold Weight (gm)"
            className="h-11 rounded-lg text-base tabular-nums sm:h-10 sm:rounded-xl sm:text-sm"
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Diamond Weight (ct) &amp; Size / Details</span>
          {rows.map((r, index) => (
            <div key={r.id} className="grid grid-cols-[5rem_minmax(0,1fr)_2.75rem] items-center gap-1.5 sm:flex">
              <Input
                inputMode="decimal"
                value={r.weight}
                onChange={(e) => updateRow(r.id, { weight: onlyNum(e.target.value) })}
                placeholder="0.50"
                aria-label={`Diamond weight (ct), row ${index + 1}`}
                className="h-11 w-20 shrink-0 rounded-lg text-base tabular-nums sm:h-9 sm:text-sm"
              />
              <Input
                value={r.note}
                onChange={(e) => updateRow(r.id, { note: e.target.value })}
                placeholder="Details / Size"
                aria-label={`Diamond size or details, row ${index + 1}`}
                className="h-11 min-w-0 flex-1 rounded-lg text-base sm:h-9 sm:text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Delete diamond row"
                onClick={() => {
                  setRows((prev) =>
                    prev.length > 1 ? prev.filter((x) => x.id !== r.id) : [newRow()],
                  );
                  setDirty(true);
                }}
                className="size-11 shrink-0 rounded-lg text-muted-foreground hover:text-destructive sm:size-9"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pt-0.5 sm:flex sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRows((prev) => [...prev, newRow()]);
                setDirty(true);
              }}
              className="h-10 justify-start gap-1 px-0 text-xs font-semibold text-primary sm:h-8"
            >
              <Plus className="size-3.5" /> Add Diamond Row
            </Button>
            <span className="text-xs font-semibold tabular-nums text-primary">
              Total: {totalDiamond.toFixed(2)} ct
            </span>
          </div>
        </div>


        <Button onClick={save} disabled={saving} className="mt-auto h-11 w-full rounded-lg sm:rounded-full">
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : !dirty && (done || savedFeedback) ? (
            <Check className="size-4" />
          ) : null}
          {savedFeedback && !dirty ? "Saved" : "Save"}
        </Button>
        <span role="status" className="sr-only">{savedFeedback && !dirty ? "Estimate saved" : ""}</span>
      </div>

    </section>
  );
}
