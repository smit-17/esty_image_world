import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Read-only product note. Shows at most 2 lines, with a "View more" toggle for
 * longer text. Renders nothing when the product has no note.
 */
export function ProductNote({ note, className }: { note?: string | null; className?: string }) {
  const [open, setOpen] = useState(false);
  const text = (note ?? "").trim();
  if (!text) return null;

  const long = text.length > 110 || text.includes("\n");

  return (
    <div className={cn("rounded-lg bg-gold/10 px-3 py-2 ring-1 ring-gold/25", className)}>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-primary/70">Note</p>
      <p
        className={cn(
          "mt-0.5 whitespace-pre-line text-sm leading-snug text-foreground",
          !open && "line-clamp-2",
        )}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="mt-0.5 text-xs font-semibold text-primary hover:underline"
        >
          {open ? "View less" : "View more"}
        </button>
      )}
    </div>
  );
}
