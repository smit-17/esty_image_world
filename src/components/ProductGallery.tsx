import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

import { signPaths } from "@/lib/lepdo";
import { cn } from "@/lib/utils";

/**
 * Product image viewer with hover arrows and a "1 / 8" counter.
 * Only the visible image is signed/fetched — no auto-slide, no preloading.
 */
export function ProductGallery({
  paths,
  alt,
  initialUrl,
  onOpen,
  className,
}: {
  paths: string[];
  alt: string;
  initialUrl?: string;
  onOpen?: (index: number) => void;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    initialUrl && paths[0] ? { [paths[0]]: initialUrl } : {},
  );

  const current = paths[index];
  const url = current ? urls[current] : undefined;

  useEffect(() => {
    if (!current) return;
    // Sign the visible image plus its immediate neighbours so ← / → is instant.
    const neighbours = [
      current,
      paths[(index + 1) % paths.length],
      paths[(index - 1 + paths.length) % paths.length],
    ].filter((p): p is string => Boolean(p));
    const missing = neighbours.filter((p) => !urls[p]);
    if (!missing.length) return;
    let alive = true;
    void signPaths(missing).then((map) => {
      if (!alive) return;
      setUrls((prev) => ({ ...prev, ...map }));
      // Warm the browser cache for the neighbours only.
      for (const [path, url] of Object.entries(map)) {
        if (path !== current) {
          const img = new Image();
          img.decoding = "async";
          img.src = url;
        }
      }
    });
    return () => {
      alive = false;
    };
  }, [current, index, paths, urls]);

  useEffect(() => {
    if (index > paths.length - 1) setIndex(0);
  }, [paths.length, index]);


  function step(e: React.MouseEvent, delta: number) {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i + delta + paths.length) % paths.length);
  }

  return (
    <div className={cn("group/gal relative aspect-square overflow-hidden bg-muted", className)}>
      {url ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onClick={onOpen ? () => onOpen(index) : undefined}
          className={cn(
            "size-full object-cover transition-transform duration-300 group-hover:scale-105",
            onOpen && "cursor-zoom-in",
          )}
        />
      ) : paths.length === 0 ? (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOff className="size-6" strokeWidth={1.5} />
        </div>
      ) : (
        <div className="size-full animate-pulse bg-muted" />
      )}

      {paths.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={(e) => step(e, -1)}
            className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-primary opacity-0 shadow-soft transition-opacity group-hover/gal:opacity-100 focus-visible:opacity-100"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={(e) => step(e, 1)}
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-primary opacity-0 shadow-soft transition-opacity group-hover/gal:opacity-100 focus-visible:opacity-100"
          >
            <ChevronRight className="size-4" />
          </button>
          <span className="absolute bottom-2 right-2 rounded-full bg-background/85 px-2 py-0.5 text-[0.65rem] font-medium tabular-nums text-primary">
            {index + 1} / {paths.length}
          </span>
        </>
      )}
    </div>
  );
}
