import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signPaths } from "@/lib/lepdo";

export function EstimateImageCarousel({ paths, cover, title, category, onOpen }: {
  paths: string[];
  cover?: string;
  title: string;
  category: string;
  onOpen: (index: number) => void;
}) {
  const [viewportRef, carousel] = useEmblaCarousel({ loop: true });
  const [index, setIndex] = useState(0);
  const { data: signed = {} } = useQuery({
    queryKey: ["signed", "estimate-carousel", paths.join(",")],
    queryFn: () => signPaths(paths),
    enabled: paths.length > 1 || (!cover && paths.length > 0),
    staleTime: 1000 * 60 * 60 * 6,
  });
  const updateIndex = useCallback(() => setIndex(carousel?.selectedScrollSnap() ?? 0), [carousel]);
  useEffect(() => {
    if (!carousel) return;
    updateIndex();
    carousel.on("select", updateIndex).on("reInit", updateIndex);
    return () => { carousel.off("select", updateIndex).off("reInit", updateIndex); };
  }, [carousel, updateIndex]);

  return (
    <div className="relative h-[180px] overflow-hidden bg-muted sm:aspect-square sm:h-auto" role="region" aria-label={`Images for ${title}`} aria-roledescription="carousel">
      <div ref={viewportRef} className="size-full overflow-hidden touch-pan-y">
        <div className="flex size-full">
          {paths.length ? paths.map((path, i) => (
            <Button key={path} type="button" variant="ghost" onClick={() => onOpen(i)} aria-label={`Preview ${title}, image ${i + 1}`} className="block h-full min-w-0 flex-[0_0_100%] rounded-none p-0 hover:bg-muted">
              {(signed[path] || (i === 0 ? cover : undefined)) ? (
                <img src={signed[path] || cover} alt={`${title}, image ${i + 1}`} loading="lazy" decoding="async" draggable={false} className="size-full object-contain sm:object-cover" />
              ) : <div className="flex size-full items-center justify-center text-muted-foreground"><ImageOff className="size-6" strokeWidth={1.5} /></div>}
            </Button>
          )) : <div className="flex size-full items-center justify-center text-muted-foreground"><ImageOff className="size-6" strokeWidth={1.5} /></div>}
        </div>
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-primary">{category}</span>
      {paths.length > 1 && <>
        <Button type="button" variant="outline" size="icon" title="Previous image" aria-label="Previous image" onClick={() => carousel?.scrollPrev()} className="absolute left-2 top-1/2 size-10 -translate-y-1/2 rounded-full border-primary/20 bg-background/90 text-primary shadow-sm"><ArrowLeft /></Button>
        <Button type="button" variant="outline" size="icon" title="Next image" aria-label="Next image" onClick={() => carousel?.scrollNext()} className="absolute right-2 top-1/2 size-10 -translate-y-1/2 rounded-full border-primary/20 bg-background/90 text-primary shadow-sm"><ArrowRight /></Button>
      </>}
      {paths.length > 0 && <span aria-live="polite" className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium tabular-nums text-primary">{index + 1}/{paths.length}</span>}
    </div>
  );
}