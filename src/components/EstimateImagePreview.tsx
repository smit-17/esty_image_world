import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EstimateImagePreview({ urls, index, title, onIndexChange, onClose }: {
  urls: string[];
  index: number;
  title?: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [viewportRef, carousel] = useEmblaCarousel({ loop: true, startIndex: index, watchDrag: zoom === 1 });
  useEffect(() => {
    if (!carousel) return;
    const selected = () => onIndexChange(carousel.selectedScrollSnap());
    carousel.on("select", selected);
    return () => { carousel.off("select", selected); };
  }, [carousel, onIndexChange]);
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    drag.current = null;
  }, [index]);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-primary/10" />
        <DialogPrimitive.Content aria-describedby={undefined} onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); carousel?.scrollPrev(); }
          if (event.key === "ArrowRight") { event.preventDefault(); carousel?.scrollNext(); }
        }} className="fixed left-1/2 top-1/2 z-50 w-[93vw] max-w-2xl max-h-[90dvh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-primary/15 bg-background shadow-xl">
          <header className="flex min-w-0 items-center gap-3 border-b border-border px-3 py-2">
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">{title || "Product image"}</DialogPrimitive.Title>
            <span aria-live="polite" className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{index + 1}/{urls.length}</span>
            <DialogPrimitive.Close asChild><Button type="button" variant="ghost" size="icon" title="Close preview" aria-label="Close image preview" className="size-9 shrink-0 rounded-full text-primary"><X /></Button></DialogPrimitive.Close>
          </header>
          <div className="relative">
            <div ref={viewportRef} className="h-[50dvh] max-h-[560px] touch-pan-y overflow-hidden">
              <div className="flex size-full">
                {urls.map((url, i) => <div key={`${url}-${i}`} className="relative h-full min-w-0 flex-[0_0_100%] overflow-hidden" onPointerDown={(event) => {
                  if (zoom <= 1) return;
                  drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }} onPointerMove={(event) => {
                  const start = drag.current;
                  if (!start) return;
                  setOffset({ x: start.ox + event.clientX - start.x, y: start.oy + event.clientY - start.y });
                }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} style={{ touchAction: zoom > 1 ? "none" : "pan-y", cursor: zoom > 1 ? "grab" : "default" }}>
                  <img src={url} alt={`${title || "Product"}, image ${i + 1}`} draggable={false} onContextMenu={(event) => event.preventDefault()} onDoubleClick={() => { setZoom(zoom > 1 ? 1 : 2); setOffset({ x: 0, y: 0 }); }} className="size-full select-none object-contain" style={{ transform: i === index ? `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` : undefined }} />
                </div>)}
              </div>
            </div>
            {urls.length > 1 && <>
              <Button type="button" variant="outline" size="icon" title="Previous image" aria-label="Previous image" onClick={() => carousel?.scrollPrev()} className="absolute left-2 top-1/2 size-10 -translate-y-1/2 rounded-full border-primary/20 bg-background/90 text-primary shadow-sm"><ArrowLeft /></Button>
              <Button type="button" variant="outline" size="icon" title="Next image" aria-label="Next image" onClick={() => carousel?.scrollNext()} className="absolute right-2 top-1/2 size-10 -translate-y-1/2 rounded-full border-primary/20 bg-background/90 text-primary shadow-sm"><ArrowRight /></Button>
            </>}
          </div>
          <footer className="flex items-center justify-center gap-2 border-t border-border py-1">
            <Button type="button" variant="ghost" size="icon" title="Zoom out" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => { setZoom(Math.max(1, zoom - 0.5)); setOffset({ x: 0, y: 0 }); }} className="size-9 text-primary"><Minus /></Button>
            <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Button type="button" variant="ghost" size="icon" title="Zoom in" aria-label="Zoom in" disabled={zoom >= 4} onClick={() => setZoom(Math.min(4, zoom + 0.5))} className="size-9 text-primary"><Plus /></Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}