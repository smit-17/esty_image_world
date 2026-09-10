import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ImageOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/ImageLightbox";
import { useAuth } from "@/lib/auth";
import {
  deleteImageRecords,
  fetchReferenceImages,
  signPaths,
  type ProductImage,
} from "@/lib/lepdo";

/**
 * Images fetched from the original finding source (Etsy, Pinterest, brand site).
 * Read-only inspiration: no cover, no QC, not counted as product images.
 */
export function ReferenceImages({
  productId,
  productName,
  sourceUrl,
}: {
  productId: string;
  productName: string;
  sourceUrl?: string | null;
}) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canRemove = can("IMAGE_DELETE");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const { data: images = [] } = useQuery({
    queryKey: ["reference-images", productId],
    queryFn: () => fetchReferenceImages(productId),
  });

  const paths = useMemo(() => images.map((i) => i.thumb_path ?? i.path), [images]);
  const { data: signed = {} } = useQuery({
    queryKey: ["signed", paths.join(",")],
    queryFn: () => signPaths(paths),
    enabled: paths.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });
  const { data: fullSigned = {} } = useQuery({
    queryKey: ["signed-full-ref", productId, images.length],
    queryFn: () => signPaths(images.map((i) => i.path)),
    enabled: openIndex !== null && images.length > 0,
    staleTime: 1000 * 60 * 60 * 6,
  });

  async function remove(img: ProductImage) {
    try {
      await deleteImageRecords([img]);
      await queryClient.invalidateQueries({ queryKey: ["reference-images", productId] });
      toast.success("Reference image removed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const lightboxUrls = images.map((i) => fullSigned[i.path]).filter(Boolean) as string[];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold">
          Source / Reference
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {images.length} fetched {images.length === 1 ? "image" : "images"}
        </span>
        {sourceUrl && (
          <Button asChild size="sm" variant="outline" className="ml-auto h-8 rounded-full">
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" /> Open original source
            </a>
          </Button>
        )}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Inspiration only — these are not our product images and are never used for cover, QC or
        downloads.
      </p>

      {images.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ImageOff className="size-6 text-gold" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No reference images fetched</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((img, index) => {
            const url = signed[img.thumb_path ?? img.path];
            return (
              <figure key={img.id} className="surface group relative overflow-hidden">
                <div className="relative aspect-square">
                  {url ? (
                    <button
                      type="button"
                      onClick={() => setOpenIndex(index)}
                      className="size-full"
                      aria-label={`Preview reference image ${index + 1}`}
                    >
                      <img
                        src={url}
                        alt={`${productName} reference ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="size-full animate-pulse bg-muted" />
                  )}
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => void remove(img)}
                      className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/90 text-destructive opacity-0 shadow-soft transition-opacity group-hover:opacity-100"
                      aria-label="Remove reference image"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                {img.source_url && (
                  <figcaption className="border-t px-2 py-1.5">
                    <a
                      href={img.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-[11px] text-primary underline underline-offset-2"
                    >
                      Source link
                    </a>
                  </figcaption>
                )}
              </figure>
            );
          })}
        </div>
      )}

      {openIndex !== null && lightboxUrls.length > 0 && (
        <ImageLightbox
          urls={lightboxUrls}
          index={Math.min(openIndex, lightboxUrls.length - 1)}
          title={`${productName} — reference`}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}
