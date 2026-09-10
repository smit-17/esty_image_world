import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  Pencil,
  Trash2,
  ImageOff,
  Download,
  Loader2,
  X,
  MoreVertical,
  UserRound,
} from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { EtsyQuickStatus } from "@/components/EtsyPanel";
import { ProductFilterBar } from "@/components/ProductFilterBar";
import { ProductGallery } from "@/components/ProductGallery";
import { QcBadge } from "@/components/QcBadge";
import {
  applyFilters,
  ANY,
  EMPTY_FILTERS,
  recallView,
  rememberView,
  type Filters,
} from "@/lib/filters";
import { estimateTotals } from "@/components/EstimateSummary";
import { useIncremental } from "@/hooks/useIncremental";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import {
  bulkAssign,
  bulkDeleteProducts,
  bulkListingStatus,
  bulkProductQc,
  qcImpact,
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

/** Tiny weight status pill used on product cards. */
function WeightPill({ estimate }: { estimate?: Parameters<typeof estimateTotals>[0] }) {
  const { gold, diamond, hasData } = estimateTotals(estimate);
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.68rem] font-semibold tabular-nums",
        hasData ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {hasData ? `${gold.toFixed(2)}g · ${diamond.toFixed(2)}ct` : "Weight: Pending"}
    </span>
  );
}

function ProductsPage() {

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, audit } = useAuth();
  const isAdmin = can("PRODUCT_UPDATE");

  const [zipId, setZipId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [qcAsk, setQcAsk] = useState<{ ids: string[]; status: QcStatus } | null>(null);
  const [qcReason, setQcReason] = useState("");

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

  // Filters, scroll position and rendered count survive a trip into a product
  // detail page and back — nothing is reset or refetched on return.
  const remembered = useRef(recallView("products"));
  const [filters, setFilters] = useState<Filters>(remembered.current?.filters ?? EMPTY_FILTERS);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(
    () => applyFilters(products, filters, { estimateByProduct, imageCountByProduct }),
    [products, filters, estimateByProduct, imageCountByProduct],
  );

  // Render progressively: only ~30 cards mount up front, more as you scroll.
  const { visible, hasMore, sentinel, count } = useIncremental(
    filtered,
    30,
    remembered.current?.count,
  );

  // Keep the remembered view in sync so returning restores it instantly.
  useEffect(() => {
    const save = () => rememberView("products", { filters, scrollY: window.scrollY, count });
    window.addEventListener("scroll", save, { passive: true });
    save();
    return () => {
      save();
      window.removeEventListener("scroll", save);
    };
  }, [filters, count]);

  const restored = useRef(false);
  useEffect(() => {
    const y = remembered.current?.scrollY ?? 0;
    if (restored.current || !y || !visible.length) return;
    restored.current = true;
    requestAnimationFrame(() => window.scrollTo({ top: y }));
  }, [visible.length]);


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
  // Selection is always reconciled against the current filter result so hidden
  // products can never be changed by a bulk action.
  const selectedIds = useMemo(
    () => filtered.filter((p) => selected[p.id]).map((p) => p.id),
    [filtered, selected],
  );
  const pageSelected =
    visible.length > 0 && visible.every((p) => selected[p.id]);
  const allFilteredSelected = filtered.length > 0 && selectedIds.length === filtered.length;

  function toggle(id: string, value: boolean) {
    setSelected((prev) => ({ ...prev, [id]: value }));
  }
  function selectPage(value: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const p of visible) next[p.id] = value;
      return next;
    });
  }
  function selectAllFiltered(value: boolean) {
    setSelected(() => {
      const next: Record<string, boolean> = {};
      if (value) for (const p of filtered) next[p.id] = true;
      return next;
    });
  }
  function clearSelection() {
    setSelected({});
  }

  // Changing any filter clears the selection — never act on products you can no
  // longer see.
  const filterKey = JSON.stringify(filters);
  const lastFilterKey = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKey.current === filterKey) return;
    lastFilterKey.current = filterKey;
    setSelected({});
  }, [filterKey]);

  async function assignSelected(ids: string[], member: string) {
    setBulkBusy("assign");
    try {
      const res = await bulkAssign(ids, member);
      audit({
        action: "PRODUCT_BULK_ACTION",
        module: "Products",
        entityType: "product",
        description: `${member ? `Assigned to ${member}` : "Unassigned"} (${res.updated.length} products)`,
        newValues: { ids: res.updated, member },
      });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      if (res.failed.length) {
        toast.error(`${res.updated.length} updated · ${res.failed.length} failed`);
        setSelected(Object.fromEntries(res.failed.map((id) => [id, true])));
      } else {
        toast.success(
          member
            ? `Assigned ${res.updated.length} to ${member}`
            : `Unassigned ${res.updated.length} products`,
        );
        clearSelection();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBulkBusy(null);
    }
  }

  async function applyQc(ids: string[], status: QcStatus, reason: string) {
    setBulkBusy("qc");
    try {
      const extra =
        status === "HOLD" || status === "REJECT"
          ? { reasons: ["Other"], note: reason.trim() }
          : undefined;
      const res = await bulkProductQc(ids, status, imagesByProduct, extra);
      audit({
        action: "QC_STATUS_CHANGE",
        module: "Products",
        entityType: "product",
        description: `QC set to ${qcLabel(status)} for ${res.updated.length} products / ${res.images} images`,
        newValues: { ids: res.updated, status, reason: extra?.note ?? null },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["images", "all"] }),
      ]);
      if (res.failed.length) {
        toast.error(
          `${res.updated.length} updated · ${res.failed.length} skipped${res.message ? ` — ${res.message}` : ""}`,
        );
        setSelected(Object.fromEntries(res.failed.map((id) => [id, true])));
      } else {
        toast.success(`QC ${qcLabel(status)} · ${res.updated.length} products · ${res.images} images`);
        clearSelection();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBulkBusy(null);
      setQcAsk(null);
      setQcReason("");
    }
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

      {/* Selection + bulk action bar */}
      {isAdmin && (
        <div className="sticky top-2 z-30 space-y-2 rounded-xl border border-border bg-card/95 px-3 py-2 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={pageSelected} onCheckedChange={(v) => selectPage(!!v)} />
              Select page ({visible.length})
            </label>
            <Button
              size="sm"
              variant={allFilteredSelected ? "secondary" : "outline"}
              className="h-8 rounded-lg"
              onClick={() => selectAllFiltered(!allFilteredSelected)}
            >
              {allFilteredSelected
                ? "Unselect all filtered"
                : `Select all filtered (${filtered.length})`}
            </Button>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
              {selectedIds.length} selected
            </span>
            {selectedIds.length > 0 && (
              <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={clearSelection}>
                <X className="size-3.5" /> Clear selection
              </Button>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-lg" disabled={!!bulkBusy}>
                    <UserRound className="size-3.5" /> Assign member
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Assign {selectedIds.length} products to</DropdownMenuLabel>
                  {team.length === 0 && <DropdownMenuItem disabled>No team members</DropdownMenuItem>}
                  {team.map((m) => (
                    <DropdownMenuItem
                      key={m.id}
                      onSelect={() => void assignSelected(selectedIds, m.name)}
                    >
                      {m.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void assignSelected(selectedIds, "")}>
                    Unassign
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-lg" disabled={!!bulkBusy}>
                    Set QC
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Set QC status</DropdownMenuLabel>
                  {QC_STATUSES.map((s) => (
                    <DropdownMenuItem
                      key={s.value}
                      onSelect={() => {
                        setQcReason("");
                        setQcAsk({ ids: selectedIds, status: s.value as QcStatus });
                      }}
                    >
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-lg" disabled={!!bulkBusy}>
                    Listing status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
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
            </div>
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
                  "surface group flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lift",
                  selected[p.id] && "ring-2 ring-primary",
                )}
              >
                <div className="relative">
                  {paths.length === 0 ? (
                    <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-muted/60 text-center">
                      <ImageOff className="size-7 text-gold" strokeWidth={1.5} />
                      <p className="text-xs font-medium text-muted-foreground">No AI Images Yet</p>
                      <Button
                        asChild
                        size="sm"
                        variant="secondary"
                        className="h-8 rounded-lg text-xs"
                      >
                        <Link to="/products/$id/edit" params={{ id: p.id }}>
                          + Add Images
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <ProductGallery
                      paths={paths}
                      alt={p.name}
                      initialUrl={paths[0] ? signed[paths[0]] : undefined}
                      onOpen={() => navigate({ to: "/products/$id", params: { id: p.id } })}
                    />
                  )}
                  {isAdmin && (
                    <label
                      className="absolute left-2 top-2 z-20 flex size-9 cursor-pointer items-center justify-center rounded-full bg-background/95 shadow-soft ring-1 ring-border"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        toggle(p.id, !selected[p.id]);
                      }}
                    >
                      <Checkbox
                        className="pointer-events-none rounded-full"
                        checked={!!selected[p.id]}
                        aria-label={`Select ${p.name}`}
                      />
                    </label>
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-primary">
                    {p.category}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 line-clamp-2 text-sm font-bold leading-snug tracking-wide text-primary">
                      SKU: {p.sku?.trim() || p.name}
                    </span>
                    <QcBadge product={p} images={imagesByProduct[p.id] ?? []} className="shrink-0" />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.team_member} · {formatDate(p.created_at)} · {count}{" "}
                    {count === 1 ? "Image" : "Images"}
                    {p.etsy_account ? ` · ${p.etsy_account}` : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <WeightPill estimate={estimateByProduct[p.id]} />
                    <div className="min-w-0 flex-1">
                      <EtsyQuickStatus product={p} />
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    <Button asChild size="sm" variant="secondary" className="flex-1 rounded-lg">
                      <Link to="/products/$id" params={{ id: p.id }}>
                        <Eye className="size-3.5" /> View
                      </Link>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          aria-label="More actions"
                        >
                          {zipId === p.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <MoreVertical className="size-3.5" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {isAdmin && (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <UserRound className="mr-2 size-3.5" /> Assign member
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                              {team.length === 0 && (
                                <DropdownMenuItem disabled>No team members</DropdownMenuItem>
                              )}
                              {team.map((m) => (
                                <DropdownMenuItem
                                  key={m.id}
                                  onSelect={() => void assignSelected([p.id], m.name)}
                                >
                                  {m.name}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => void assignSelected([p.id], "")}>
                                Unassign
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        )}
                        {isAdmin && (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Set QC</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {QC_STATUSES.map((s) => (
                                <DropdownMenuItem
                                  key={s.value}
                                  onSelect={() => {
                                    setQcReason("");
                                    setQcAsk({ ids: [p.id], status: s.value as QcStatus });
                                  }}
                                >
                                  {s.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        )}
                        {can("IMAGE_DOWNLOAD") && (
                          <DropdownMenuItem
                            disabled={zipId === p.id || count === 0}
                            onSelect={() => void downloadProduct(p)}
                          >
                            <Download className="mr-2 size-3.5" /> Download images
                          </DropdownMenuItem>
                        )}
                        {can("PRODUCT_DELETE") && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setPendingDelete(p.id)}
                            >
                              <Trash2 className="mr-2 size-3.5" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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

      {/* QC confirmation — shows exactly what will change before it happens. */}
      <AlertDialog open={!!qcAsk} onOpenChange={(o) => !o && setQcAsk(null)}>
        <AlertDialogContent className="rounded-2xl">
          {qcAsk && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Set QC to {qcLabel(qcAsk.status)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {(() => {
                    const impact = qcImpact(qcAsk.ids, imagesByProduct, qcAsk.status);
                    return (
                      <>
                        This updates {impact.products}{" "}
                        {impact.products === 1 ? "product" : "products"} and {impact.images}{" "}
                        original {impact.images === 1 ? "image" : "images"}. Reference images are
                        never included.
                        {impact.skipped > 0 && (
                          <>
                            {" "}
                            {impact.skipped} cannot pass — they have no original images yet.
                          </>
                        )}
                      </>
                    );
                  })()}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {(qcAsk.status === "HOLD" || qcAsk.status === "REJECT") && (
                <Input
                  autoFocus
                  value={qcReason}
                  onChange={(e) => setQcReason(e.target.value)}
                  placeholder="Reason (required)"
                  className="rounded-lg"
                />
              )}
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-full"
                  disabled={
                    ((qcAsk.status === "HOLD" || qcAsk.status === "REJECT") &&
                      !qcReason.trim()) ||
                    qcImpact(qcAsk.ids, imagesByProduct, qcAsk.status).products === 0
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    void applyQc(qcAsk.ids, qcAsk.status, qcReason);
                  }}
                >
                  Apply
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

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
