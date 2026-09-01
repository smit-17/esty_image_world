import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Trash2,
  ImageOff,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { EtsyPanel } from "@/components/EtsyPanel";
import { EstimatePanel } from "@/components/EstimateSummary";
import { QcBadge } from "@/components/QcBadge";
import {
  ImageQcControls,
  ImageSelectBox,
  imageQcOf,
  useImageQcMutation,
} from "@/components/ImageQc";
import {
  deleteProduct,
  downloadProductImages,
  downloadSingleImage,
  fetchEstimates,
  fetchImages,
  fetchProduct,
  formatBytes,
  QC_STATUSES,
  formatDate,
  signPaths,
  type ProductImage,
} from "@/lib/lepdo";


export const Route = createFileRoute("/_app/products/$id/")({
  head: () => ({
    meta: [
      { title: "Product detail — LEPDO Lifestyle Image Manager" },
      {
        name: "description",
        content: "View every AI-generated image, note and detail for this LEPDO Lifestyle product.",
      },
      { property: "og:title", content: "Product detail — LEPDO Lifestyle" },
      { property: "og:description", content: "View images, notes and details for this jewelry product." },
    ],
  }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { id } = useParams({ from: "/_app/products/$id/" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const applyQc = useImageQcMutation(id);

  const { data: product } = useQuery({ queryKey: ["product", id], queryFn: () => fetchProduct(id) });
  const { data: images = [] } = useQuery({
    queryKey: ["product-images", id],
    queryFn: () => fetchImages(id),
  });
  const { data: estimates = [] } = useQuery({ queryKey: ["estimates"], queryFn: fetchEstimates });
  const estimate = estimates.find((e) => e.product_id === id);


  // Thumbnails for the grid — full-resolution images are only fetched on open/download.
  const thumbKeys = images.map((i) => i.thumb_path ?? i.path);
  const { data: signed = {} } = useQuery({
    queryKey: ["signed", thumbKeys.join(",")],
    queryFn: () => signPaths(thumbKeys),
    enabled: images.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });
  const lightbox = lightboxIndex === null ? null : (images[lightboxIndex] ?? null);
  const { data: fullSigned = {} } = useQuery({
    queryKey: ["signed-full", lightbox?.path ?? ""],
    queryFn: () => signPaths([lightbox!.path]),
    enabled: !!lightbox,
    staleTime: 1000 * 60 * 60 * 6,
  });

  const qcCounts = useMemo(() => {
    const c = { PENDING: 0, PASS: 0, HOLD: 0, REJECT: 0 } as Record<string, number>;
    images.forEach((i) => {
      const s = imageQcOf(i);
      c[s] = (c[s] ?? 0) + 1;
    });
    return c;
  }, [images]);

  const totalBytes = images.reduce((s, i) => s + Number(i.size_bytes ?? 0), 0);

  async function confirmDelete() {
    try {
      await deleteProduct(id);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["images", "all"] });
      toast.success("Product deleted");
      navigate({ to: "/products" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function downloadAll() {
    if (!product) return;
    setZipping(true);
    setZipProgress(0);
    try {
      await downloadProductImages(product, images, (done, total) =>
        setZipProgress(Math.round((done / total) * 100)),
      );
      toast.success("Download ready");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setZipping(false);
    }
  }

  async function downloadOne(img: ProductImage, index: number) {
    if (!product) return;
    setDownloadingId(img.id);
    try {
      await downloadSingleImage(product, img, index);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloadingId(null);
    }
  }

  if (!product) {
    return <div className="surface h-64 animate-pulse" />;
  }

  return (
    <div className="space-y-7">
      <Link
        to="/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Back to products
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">{product.category}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary/10 px-3 py-1.5 text-base font-bold tabular-nums tracking-wide text-primary">
              SKU: {product.sku?.trim() || "—"}
            </span>
            <QcBadge product={product} />
          </div>
          <h1 className="mt-2 text-3xl text-primary lg:text-4xl">{product.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {product.team_member} · {formatDate(product.created_at)} · {images.length} images ·{" "}
            {formatBytes(totalBytes)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-full px-5"
            disabled={zipping || images.length === 0}
            onClick={downloadAll}
          >
            {zipping ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {zipping ? `Zipping ${zipProgress}%` : `Download all (${images.length})`}
          </Button>
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link to="/products/$id/edit" params={{ id }}>
              <Pencil className="size-4" /> Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            className="rounded-full px-5 text-destructive hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </header>

      <EtsyPanel product={product} />

      <EstimatePanel estimate={estimate} />


      {product.reference_url && (
        <div className="surface flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-eyebrow">Reference / inspiration link</p>
            <a
              href={product.reference_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block truncate text-sm text-primary underline underline-offset-4"
            >
              {product.reference_url}
            </a>
          </div>
          <Button asChild variant="outline" className="rounded-full px-5">
            <a href={product.reference_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" /> Open reference
            </a>
          </Button>
        </div>
      )}

      {product.notes?.trim() && (
        <div className="surface p-6">
          <p className="text-eyebrow">Product Note</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{product.notes}</p>
        </div>
      )}

      {images.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 px-6 py-20 text-center">
          <ImageOff className="size-8 text-gold" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No images attached to this product yet.</p>
        </div>
      ) : (
        <>
          <div className="surface flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
            <span className="text-eyebrow">Image QC</span>
            <span className="font-semibold tabular-nums">Images: {images.length}</span>
            <span className="tabular-nums text-emerald-700">Pass: {qcCounts.PASS}</span>
            <span className="tabular-nums text-muted-foreground">Pending: {qcCounts.PENDING}</span>
            <span className="tabular-nums text-amber-700">Hold: {qcCounts.HOLD}</span>
            <span className="tabular-nums text-destructive">Reject: {qcCounts.REJECT}</span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full"
                onClick={() =>
                  setSelected(
                    selected.length === images.length ? [] : images.map((i) => i.id),
                  )
                }
              >
                {selected.length === images.length ? "Clear selection" : "Select all"}
              </Button>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="surface sticky top-2 z-20 flex flex-wrap items-center gap-2 p-3">
              <span className="text-sm font-medium tabular-nums">{selected.length} selected</span>
              {QC_STATUSES.map((s) => (
                <Button
                  key={s.value}
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full"
                  onClick={() => {
                    void applyQc(selected, s.value);
                    setSelected([]);
                  }}
                >
                  {s.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-full"
                onClick={() => setSelected([])}
              >
                Cancel
              </Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {images.map((img, index) => {
              const url = signed[img.thumb_path ?? img.path];
              const isSelected = selected.includes(img.id);
              return (
                <figure key={img.id} className="surface group overflow-hidden">
                  <div className="relative aspect-square">
                    <ImageSelectBox
                      checked={isSelected}
                      onChange={(v) =>
                        setSelected((cur) =>
                          v ? [...cur, img.id] : cur.filter((id) => id !== img.id),
                        )
                      }
                    />
                    {url ? (
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(index)}
                        className="size-full"
                        aria-label={`Open ${product.name} image`}
                      >
                        <img
                          src={url}
                          alt={product.name}
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </button>
                    ) : (
                      <div className="size-full animate-pulse bg-muted" />
                    )}
                    <button
                      type="button"
                      onClick={() => downloadOne(img, index)}
                      disabled={downloadingId === img.id}
                      className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-background/90 text-primary opacity-0 shadow-soft transition-opacity group-hover:opacity-100"
                      aria-label="Download original image"
                    >
                      {downloadingId === img.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Download className="size-4" />
                      )}
                    </button>
                  </div>
                  <figcaption className="border-t p-2">
                    <ImageQcControls image={img} onApply={(ids, status, extra) => void applyQc(ids, status, extra)} />
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </>
      )}


      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightboxIndex(null)}>
        <DialogContent className="max-w-4xl overflow-hidden rounded-2xl p-2">
          {lightbox && (
            <div className="relative">
              {fullSigned[lightbox.path] ? (
                <img
                  src={fullSigned[lightbox.path]}
                  alt={product.name}
                  className="max-h-[80vh] w-full rounded-xl object-contain"
                />
              ) : (
                <div className="flex h-72 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={() =>
                      setLightboxIndex((i) => ((i ?? 0) - 1 + images.length) % images.length)
                    }
                    className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-primary shadow-soft"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={() => setLightboxIndex((i) => ((i ?? 0) + 1) % images.length)}
                    className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-primary shadow-soft"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-xs font-medium tabular-nums text-primary">
                    {(lightboxIndex ?? 0) + 1} / {images.length}
                  </span>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{product.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the product and all of its images.
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
