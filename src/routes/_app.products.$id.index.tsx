import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Download, Pencil, Trash2, ImageOff, Loader2 } from "lucide-react";
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
import {
  deleteProduct,
  downloadProductImages,
  downloadSingleImage,
  fetchImages,
  fetchProduct,
  formatBytes,
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
  const [lightbox, setLightbox] = useState<ProductImage | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: product } = useQuery({ queryKey: ["product", id], queryFn: () => fetchProduct(id) });
  const { data: images = [] } = useQuery({
    queryKey: ["product-images", id],
    queryFn: () => fetchImages(id),
  });

  // Thumbnails for the grid — full-resolution images are only fetched on open/download.
  const thumbKeys = images.map((i) => i.thumb_path ?? i.path);
  const { data: signed = {} } = useQuery({
    queryKey: ["signed", thumbKeys.join(",")],
    queryFn: () => signPaths(thumbKeys),
    enabled: images.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });
  const { data: fullSigned = {} } = useQuery({
    queryKey: ["signed-full", lightbox?.path ?? ""],
    queryFn: () => signPaths([lightbox!.path]),
    enabled: !!lightbox,
    staleTime: 1000 * 60 * 60 * 6,
  });

  const totalBytes = images.reduce((s, i) => s + Number(i.size_bytes ?? 0), 0);

  async function confirmDelete() {
    try {
      await deleteProduct(id);
      queryClient.invalidateQueries();
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
          <h1 className="mt-1 text-3xl text-primary lg:text-4xl">{product.name}</h1>
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

      {product.notes && (
        <div className="surface p-6">
          <p className="text-eyebrow">Notes</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{product.notes}</p>
        </div>
      )}

      {images.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 px-6 py-20 text-center">
          <ImageOff className="size-8 text-gold" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No images attached to this product yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {images.map((img, index) => {
            const url = signed[img.thumb_path ?? img.path];
            return (
              <figure key={img.id} className="surface group relative aspect-square overflow-hidden">
                {url ? (
                  <button
                    type="button"
                    onClick={() => setLightbox(img)}
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
              </figure>
            );
          })}
        </div>
      )}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl overflow-hidden rounded-2xl p-2">
          {lightbox &&
            (fullSigned[lightbox.path] ? (
              <img
                src={fullSigned[lightbox.path]}
                alt={product.name}
                className="max-h-[80vh] w-full rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-72 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ))}
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
