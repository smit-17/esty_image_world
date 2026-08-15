import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Eye, Pencil, Trash2, ImageOff, Download, Loader2 } from "lucide-react";
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
import { EstimateLine } from "@/components/EstimateSummary";

import {
  deleteProduct,
  downloadProductImages,
  ETSY_STATUSES,
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

const ALL = "__all__";

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

  const estimateProductIds = useMemo(() => new Set(estimates.map((e) => e.product_id)), [estimates]);


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

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [member, setMember] = useState(ALL);
  const [range, setRange] = useState(ALL);
  const [etsy, setEtsy] = useState(ALL);
  const [estimate, setEstimate] = useState(ALL);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const estimateCounts = useMemo(() => {
    const now = Date.now();
    const base = (p: Product) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== ALL && p.category !== category) return false;
      if (member !== ALL && p.team_member !== member) return false;
      if (etsy !== ALL && (p.etsy_status ?? "not_listed") !== etsy) return false;
      if (range !== ALL) {
        const days = Number(range);
        if (now - new Date(p.created_at).getTime() > days * 86400000) return false;
      }
      return true;
    };
    let all = 0;
    let added = 0;
    let notAdded = 0;
    for (const p of products) {
      if (!base(p)) continue;
      all += 1;
      if (estimateProductIds.has(p.id)) added += 1;
      else notAdded += 1;
    }
    return { all, added, notAdded };
  }, [products, estimates, search, category, member, etsy, range]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== ALL && p.category !== category) return false;
      if (member !== ALL && p.team_member !== member) return false;
      if (etsy !== ALL && (p.etsy_status ?? "not_listed") !== etsy) return false;
      if (range !== ALL) {
        const days = Number(range);
        if (now - new Date(p.created_at).getTime() > days * 86400000) return false;
      }
      if (estimate !== ALL) {
        const has = estimateProductIds.has(p.id);
        if (estimate === "added" && !has) return false;
        if (estimate === "not_added" && has) return false;
      }
      return true;
    });
  }, [products, search, category, member, range, etsy, estimate, estimateProductIds]);

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
        <p className="text-sm text-muted-foreground">
          {filtered.length} of {products.length} products
        </p>
      </header>

      <div className="surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
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
        <Select value={member} onValueChange={setMember}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Team member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All team members</SelectItem>
            {team.map((t) => (
              <SelectItem key={t.id} value={t.name}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={etsy} onValueChange={setEtsy}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Etsy status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Etsy statuses</SelectItem>
            {ETSY_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any date</SelectItem>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={estimate} onValueChange={setEstimate}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Estimation status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All ({estimateCounts.all})</SelectItem>
            <SelectItem value="added">Estimation Added ({estimateCounts.added})</SelectItem>
            <SelectItem value="not_added">Estimation Not Added ({estimateCounts.notAdded})</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
