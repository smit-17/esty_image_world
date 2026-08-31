import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Eye, Pencil, Trash2, ImageOff, Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EtsyQuickStatus } from "@/components/EtsyPanel";
import { ProductFilterBar } from "@/components/ProductFilterBar";
import { ProductGallery } from "@/components/ProductGallery";
import { QcBadge } from "@/components/QcBadge";
import { applyFilters, ANY, EMPTY_FILTERS, type Filters } from "@/lib/filters";
import { EstimateLine } from "@/components/EstimateSummary";
import { useIncremental } from "@/hooks/useIncremental";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import {
  bulkAssign,
  bulkDeleteProducts,
  bulkListingStatus,
  deleteProduct,
  downloadProductImages,
  downloadProductsZip,
  ETSY_STATUSES,
  fetchCategories,
  fetchEstimates,
  fetchImages,
  fetchProducts,
  fetchTeam,
  formatDate,
  QC_STATUSES,
  qcLabel,
  signPaths,
  updateQcStatus,
  type EtsyStatus,
  type Product,
  type ProductEstimate,
  type ProductImage,
  type QcStatus,
} from "@/lib/lepdo";

export const Route = createFileRoute("/_app/products/")({
  head: () => ({
    meta: [
      { title: "Products — LEPDO Lifestyle Image Manager" },
      {
        name: "description",
        content: "Browse, filter and search every AI-generated jewelry product in the LEPDO library.",
      },
      { property: "og:title", content: "Products — LEPDO Lifestyle" },
      { property: "og:description", content: "Browse and search the LEPDO AI jewelry product library." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, audit } = useAuth();
  const isAdmin = can("PRODUCT_UPDATE");

  const [zipId, setZipId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);

  const { data: products = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: images = [] } = useQuery({ queryKey: ["images", "all"], queryFn: () => fetchImages() });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: fetchTeam });
  const { data: estimates = [] } = useQuery({ queryKey: ["estimates"], queryFn: fetchEstimates });

  const estimateByProduct = useMemo(() => {
    const map: Record<string, ProductEstimate> = {};
    for (const e of estimates) map[e.product_id] = e;
    return map;
  }, [estimates]);

  const imagesByProduct = useMemo(() => {
    const map: Record<string, ProductImage[]> = {};
    for (const i of images) (map[i.product_id] ??= []).push(i);
    return map;
  }, [images]);

  const imageCountByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const id of Object.keys(imagesByProduct)) map[id] = imagesByProduct[id].length;
    return map;
  }, [imagesByProduct]);

  async function downloadProduct(p: Product) {
    setZipId(p.id);
    try {
      await downloadProductImages(p, imagesByProduct[p.id] ?? []);
      toast.success("Download ready");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setZipId(null);
    }
  }

  // Prefer lightweight thumbnails for card covers.
  const galleryByProduct = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of products) {
      const own = imagesByProduct[p.id] ?? [];
      const ordered = [...own].sort((a, b) => {
        if (a.path === p.cover_url) return -1;
        if (b.path === p.cover_url) return 1;
        return 0;
      });
      const paths = ordered.map((i) => i.thumb_path ?? i.path);
      if (!paths.length && p.cover_url) paths.push(p.cover_url);
      map[p.id] = paths;
    }
    return map;
  }, [products, imagesByProduct]);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(
    () => applyFilters(products, filters, { estimateByProduct, imageCountByProduct }),
    [products, filters, estimateByProduct, imageCountByProduct],
  );

  // Render progressively: only ~30 cards mount up front, more as you scroll.
  const { visible, hasMore, sentinel } = useIncremental(filtered, 30);

  // Sign only the first (cover) thumbnail of the cards actually rendered; the
  // gallery signs the rest on demand when the arrows are used.
  const coverPaths = useMemo(
    () => visible.map((p) => galleryByProduct[p.id]?.[0]).filter(Boolean) as string[],
    [visible, galleryByProduct],
  );
  const { data: signed = {} } = useQuery({
    queryKey: ["signed", coverPaths.join(",")],
    queryFn: () => signPaths(coverPaths),
    enabled: coverPaths.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });

  /* ------------------------- category tabs ------------------------- */
  const tabs = useMemo(() => {
    const names = Array.from(
      new Set([...categories.map((c) => c.name), ...products.map((p) => p.category)]),
    ).filter(Boolean);
    const counts: Record<string, number> = {};
    for (const p of products) counts[p.category] = (counts[p.category] ?? 0) + 1;
    return [
      { value: ANY, label: "All", count: products.length },
      ...names
        .map((n) => ({ value: n, label: n, count: counts[n] ?? 0 }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    ];
  }, [categories, products]);

  /* --------------------------- selection --------------------------- */
  const selectedIds = useMemo(
    () => filtered.filter((p) => selected[p.id]).map((p) => p.id),
    [filtered, selected],
  );
  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;

  function toggle(id: string, value: boolean) {
    setSelected((prev) => ({ ...prev, [id]: value }));
  }
  function toggleAll(value: boolean) {
    const next: Record<string, boolean> = { ...selected };
    for (const p of filtered) next[p.id] = value;
    setSelected(next);
  }
  function clearSelection() {
    setSelected({});
  }

  async function runBulk(kind: string, fn: () => Promise<void>, message: string, log: string) {
    setBulkBusy(kind);
    try {
      await fn();
      audit({
        action: "PRODUCT_BULK_ACTION",
        module: "Products",
        entityType: "product",
        description: `${log} (${selectedIds.length} products)`,
        newValues: { ids: selectedIds },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["images", "all"] }),
      ]);
      toast.success(message);
      if (kind === "delete") clearSelection();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBulkBusy(null);
      setBulkDelete(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteProduct(pendingDelete);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["images", "all"] });
      toast.success("Product deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setPendingDelete(null);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-eyebrow">Library</p>
          <h1 className="mt-0.5 text-3xl text-primary lg:text-4xl">Products</h1>
        </div>
      </header>

      {/* Category tabs */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => {
          const active = filters.category === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, category: t.value }))}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-primary",
              )}
            >
              {t.label}{" "}
              <span className={cn("tabular-nums", active ? "opacity-80" : "opacity-60")}>{t.count}</span>
            </button>
          );
        })}
      </div>

      <ProductFilterBar
        scope="products"
        filters={filters}
        onChange={setFilters}
        categories={categories.map((c) => c.name)}
        team={team.map((t) => t.name)}
        resultCount={filtered.length}
        totalCount={products.length}
      />

      {/* Bulk action bar */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
            Select all ({filtered.length})
          </label>

          {selectedIds.length > 0 && (
            <>
              <span className="ml-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
                {selectedIds.length} selected
              </span>

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-lg">
                      Listing status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Set listing status</DropdownMenuLabel>
                    {ETSY_STATUSES.map((s) => (
                      <DropdownMenuItem
                        key={s.value}
                        onSelect={() =>
                          void runBulk(
                            "listing",
                            () => bulkListingStatus(selectedIds, s.value as EtsyStatus),
                            `Listing status set to ${s.label}`,
                            `Listing status set to ${s.label}`,
                          )
                        }
                      >
                        {s.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-lg">
                      QC status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Set QC status</DropdownMenuLabel>
                    {QC_STATUSES.map((s) => (
                      <DropdownMenuItem
                        key={s.value}
                        onSelect={() =>
                          void runBulk(
                            "qc",
                            () => updateQcStatus(selectedIds, s.value as QcStatus),
                            `QC set to ${s.label}`,
                            `QC status set to ${qcLabel(s.value)}`,
                          )
                        }
                      >
                        {s.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-lg">
                      Assign
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                    <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                    {team.length === 0 && (
                      <DropdownMenuItem disabled>No team members</DropdownMenuItem>
                    )}
                    {team.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onSelect={() =>
                          void runBulk(
                            "assign",
                            () => bulkAssign(selectedIds, m.name),
                            `Assigned to ${m.name}`,
                            `Assigned to ${m.name}`,
                          )
                        }
                      >
                        {m.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {can("IMAGE_DOWNLOAD") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    disabled={bulkBusy === "download"}
                    onClick={() =>
                      void runBulk(
                        "download",
                        () =>
                          downloadProductsZip(
                            filtered.filter((p) => selected[p.id]),
                            imagesByProduct,
                          ),
                        "Download ready",
                        "Bulk image download",
                      )
                    }
                  >
                    {bulkBusy === "download" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    Download
                  </Button>
                )}

                {can("PRODUCT_DELETE") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg text-destructive hover:text-destructive"
                    onClick={() => setBulkDelete(true)}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                )}

                <Button size="sm" variant="ghost" className="rounded-lg" onClick={clearSelection}>
                  <X className="size-3.5" /> Clear
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="surface aspect-[4/5] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 px-6 py-16 text-center">
          <ImageOff className="size-8 text-gold" strokeWidth={1.5} />
          <h3 className="text-xl">No products found</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Adjust your filters, or add a new product to start building the library.
          </p>
          <Button asChild className="mt-2 rounded-full px-6">
            <Link to="/products/new">Add product</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => {
            const paths = galleryByProduct[p.id] ?? [];
            const count = imageCountByProduct[p.id] ?? 0;
            return (
              <article
                key={p.id}
                className={cn(
                  "surface group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lift",
                  selected[p.id] && "ring-2 ring-primary",
                )}
              >
                <div className="relative">
                  <ProductGallery
                    paths={paths}
                    alt={p.name}
                    initialUrl={paths[0] ? signed[paths[0]] : undefined}
                    onOpen={() => navigate({ to: "/products/$id", params: { id: p.id } })}
                  />
                  {isAdmin && (
                    <label className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-md bg-background/90 shadow-soft">
                      <Checkbox
                        checked={!!selected[p.id]}
                        onCheckedChange={(v) => toggle(p.id, !!v)}
                        aria-label={`Select ${p.name}`}
                      />
                    </label>
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-primary">
                    {p.category}
                  </span>
                </div>

                <div className="space-y-1 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-primary/10 px-2 py-1 text-sm font-bold tabular-nums tracking-wide text-primary">
                      SKU: {p.sku?.trim() || "—"}
                    </span>
                    <QcBadge product={p} />
                  </div>
                  <h3 className="truncate pt-1 text-lg leading-snug">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {p.team_member} · {formatDate(p.created_at)} · {count}{" "}
                    {count === 1 ? "image" : "images"}
                  </p>
                  {p.etsy_account && (
                    <p className="truncate text-xs text-muted-foreground">Etsy · {p.etsy_account}</p>
                  )}
                  <EstimateLine estimate={estimateByProduct[p.id]} />
                  <div className="pt-1.5">
                    <EtsyQuickStatus product={p} />
                  </div>

                  <div className="flex gap-1.5 pt-2.5">
                    <Button asChild size="sm" variant="secondary" className="flex-1 rounded-lg">
                      <Link to="/products/$id" params={{ id: p.id }}>
                        <Eye className="size-3.5" /> View
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      disabled={zipId === p.id || count === 0}
                      onClick={() => downloadProduct(p)}
                      aria-label="Download all images"
                    >
                      {zipId === p.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => navigate({ to: "/products/$id/edit", params: { id: p.id } })}
                      aria-label="Edit product"
                    >
                      <Pencil className="size-3.5" />
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(p.id)}
                      aria-label="Delete product"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div ref={sentinel} className="py-6 text-center text-xs text-muted-foreground">
          Loading more products…
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the product and all of its images from the library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="rounded-full">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDelete} onOpenChange={setBulkDelete}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} products?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected products and all of their images.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              onClick={() =>
                void runBulk(
                  "delete",
                  () => bulkDeleteProducts(selectedIds),
                  "Products deleted",
                  "Bulk product delete",
                )
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
