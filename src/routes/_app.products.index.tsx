import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Eye, Pencil, Trash2, ImageOff, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { EtsyQuickStatus } from "@/components/EtsyPanel";
import { ProductFilterBar } from "@/components/ProductFilterBar";
import { applyFilters, EMPTY_FILTERS, type Filters } from "@/lib/filters";
import { EstimateLine } from "@/components/EstimateSummary";

import {
  deleteProduct,
  downloadProductImages,
  fetchCategories,
  fetchEstimates,
  fetchImages,
  fetchProducts,
  fetchTeam,
  formatDate,
  signPaths,
  type Product,
  type ProductEstimate,
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
  const [zipId, setZipId] = useState<string | null>(null);
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

  const imageCountByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of images) map[i.product_id] = (map[i.product_id] ?? 0) + 1;
    return map;
  }, [images]);

  async function downloadProduct(p: Product) {
    setZipId(p.id);
    try {
      await downloadProductImages(
        p,
        images.filter((i) => i.product_id === p.id),
      );
      toast.success("Download ready");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setZipId(null);
    }
  }

  // Prefer lightweight thumbnails for card covers.
  const coverByProduct = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of products) {
      const own = images.filter((i) => i.product_id === p.id);
      const cover = own.find((i) => i.path === p.cover_url) ?? own[0];
      if (cover) map[p.id] = cover.thumb_path ?? cover.path;
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

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(
    () => applyFilters(products, filters, { estimateByProduct, imageCountByProduct }),
    [products, filters, estimateByProduct, imageCountByProduct],
  );

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteProduct(pendingDelete);
      queryClient.invalidateQueries();
      toast.success("Product deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setPendingDelete(null);
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Library</p>
          <h1 className="mt-1 text-3xl text-primary lg:text-4xl">Products</h1>
        </div>
      </header>

      <ProductFilterBar
        scope="products"
        filters={filters}
        onChange={setFilters}
        categories={categories.map((c) => c.name)}
        team={team.map((t) => t.name)}
        resultCount={filtered.length}
        totalCount={products.length}
      />

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="surface aspect-[4/5] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 px-6 py-20 text-center">
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const count = images.filter((i) => i.product_id === p.id).length;
            const coverKey = coverByProduct[p.id];
            const cover = coverKey ? signed[coverKey] : undefined;
            return (
              <article
                key={p.id}
                className="surface group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <Link to="/products/$id" params={{ id: p.id }} className="block">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {cover ? (
                      <img
                        src={cover}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageOff className="size-6" strokeWidth={1.5} />
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-primary">
                      {p.category}
                    </span>
                  </div>
                </Link>
                <div className="space-y-1 p-4">
                  <h3 className="truncate text-lg leading-snug">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {p.team_member} · {formatDate(p.created_at)} · {count}{" "}
                    {count === 1 ? "image" : "images"}
                  </p>
                  {p.etsy_account && (
                    <p className="truncate text-xs text-muted-foreground">Etsy · {p.etsy_account}</p>
                  )}
                  <EstimateLine estimate={estimateByProduct[p.id]} />
                  <div className="pt-2">
                    <EtsyQuickStatus product={p} />
                  </div>

                  <div className="flex gap-1.5 pt-3">
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
    </div>
  );
}
