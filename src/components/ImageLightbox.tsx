import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function ImageLightbox({
  urls,
  index,
  title,
  onIndexChange,
  onClose,
}: {
  urls: string[];
  index: number;
  title?: string;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    reset();
  }, [index, reset]);

  const go = useCallback(
    (dir: number) => {
      if (urls.length < 2) return;
      onIndexChange((index + dir + urls.length) % urls.length);
    },
    [index, urls.length, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  const zoomAt = useCallback((next: number, px: number, py: number) => {
    setZoom((z) => {
      const target = clamp(next, MIN_ZOOM, MAX_ZOOM);
      const k = target / z;
      setOffset((o) =>
        target === MIN_ZOOM
          ? { x: 0, y: 0 }
          : { x: px - (px - o.x) * k, y: py - (py - o.y) * k },
      );
      return target;
    });
  }, []);

  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    zoomAt(zoom * Math.exp(-dy * 0.002), e.clientX - rect.left, e.clientY - rect.top);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelRef.current(e);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const step = (factor: number) => {
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect();
    zoomAt(zoom * factor, (rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-primary/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-primary-foreground">
        <p className="min-w-0 truncate text-sm font-medium">
          {title}
          {urls.length > 1 ? ` · ${index + 1}/${urls.length}` : ""}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          aria-label="Close image preview"
          className="size-10 shrink-0 rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
        >
          <X className="size-5" />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 touch-none overflow-hidden"
        style={{ cursor: zoom > 1 ? "grab" : "default" }}
        onPointerDown={(e) => {
          if (zoom <= 1) return;
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
        }}
        onPointerUp={() => (drag.current = null)}
        onDoubleClick={(e) => {
          const rect = containerRef.current!.getBoundingClientRect();
          zoomAt(zoom > 1 ? 1 : 2.5, e.clientX - rect.left, e.clientY - rect.top);
        }}
      >
        <img
          src={urls[index]}
          alt={title ?? "Product image"}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute left-0 top-0 size-full select-none object-contain"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        />

        {urls.length > 1 && (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 size-11 -translate-y-1/2 rounded-full"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 size-11 -translate-y-1/2 rounded-full"
            >
              <ChevronRight className="size-5" />
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 px-4 py-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => step(1 / 1.4)}
          aria-label="Zoom out"
          className="size-11 rounded-full"
        >
          <Minus className="size-4" />
        </Button>
        <span className="min-w-16 text-center text-sm tabular-nums text-primary-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => step(1.4)}
          aria-label="Zoom in"
          className="size-11 rounded-full"
        >
          <Plus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={reset}
          aria-label="Reset zoom"
          className="size-11 rounded-full"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>
    </div>
  );
}
