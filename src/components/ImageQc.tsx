import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  IMAGE_QC_REASONS,
  QC_STATUSES,
  updateImageQc,
  type ProductImage,
  type QcStatus,
} from "@/lib/lepdo";

export const imageQcOf = (img: ProductImage): QcStatus =>
  ((img.qc_status ?? "PENDING").toUpperCase() as QcStatus) ?? "PENDING";

export function imageQcTone(status: QcStatus) {
  switch (status) {
    case "PASS":
      return "border-emerald-600/30 bg-emerald-600/10 text-emerald-700";
    case "HOLD":
      return "border-amber-600/30 bg-amber-500/10 text-amber-700";
    case "REJECT":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted/60 text-muted-foreground";
  }
}

/** Optimistically patch the cached image rows for a product. */
export function useImageQcMutation(productId: string) {
  const queryClient = useQueryClient();
  const key = ["product-images", productId];

  return async function apply(
    ids: string[],
    status: QcStatus,
    extra?: { reasons?: string[]; note?: string | null },
  ) {
    if (!ids.length) return;
    const prev = queryClient.getQueryData<ProductImage[]>(key);
    queryClient.setQueryData<ProductImage[]>(key, (rows) =>
      rows?.map((r) =>
        ids.includes(r.id)
          ? {
              ...r,
              qc_status: status,
              qc_reasons: extra ? (extra.reasons ?? []) : status === "HOLD" || status === "REJECT" ? (r.qc_reasons ?? []) : [],
              qc_note: extra ? (extra.note ?? null) : status === "HOLD" || status === "REJECT" ? (r.qc_note ?? null) : null,
              qc_updated_at: new Date().toISOString(),
            }
          : r,
      ),
    );
    try {
      await updateImageQc(ids, status, extra);
    } catch (e) {
      queryClient.setQueryData(key, prev);
      toast.error((e as Error).message);
    }
  };
}

/* ------------------------------------------------------------------ */

export function ImageQcControls({
  image,
  onApply,
}: {
  image: ProductImage;
  onApply: (ids: string[], status: QcStatus, extra?: { reasons?: string[]; note?: string | null }) => void;
}) {
  const status = imageQcOf(image);
  const reasons = image.qc_reasons ?? [];
  const needsReasons = status === "HOLD" || status === "REJECT";
  const [note, setNote] = useState(image.qc_note ?? "");

  function toggleReason(reason: string) {
    const next = reasons.includes(reason)
      ? reasons.filter((r) => r !== reason)
      : [...reasons, reason];
    onApply([image.id], status, { reasons: next, note: next.includes("Other") ? note : null });
  }

  return (
    <div className="space-y-1.5">
      <Select value={status} onValueChange={(v) => onApply([image.id], v as QcStatus)}>
        <SelectTrigger
          className={cn("h-8 rounded-lg border text-xs font-medium", imageQcTone(status))}
          aria-label="Image QC status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QC_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value} className="text-xs">
              QC: {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {needsReasons && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-8 w-full justify-between rounded-lg px-2 text-xs font-normal"
            >
              <span className="truncate">
                {reasons.length ? reasons.join(", ") : "What needs change?"}
              </span>
              <ChevronDown className="size-3.5 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {IMAGE_QC_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleReason(r)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                >
                  <span className="flex size-4 items-center justify-center rounded border">
                    {reasons.includes(r) && <Check className="size-3" />}
                  </span>
                  {r}
                </button>
              ))}
            </div>
            {reasons.includes("Other") && (
              <div className="mt-2 flex gap-1.5">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Short note…"
                  className="h-8 rounded-lg text-xs"
                />
                <Button
                  size="sm"
                  className="h-8 rounded-lg"
                  onClick={() => onApply([image.id], status, { reasons, note })}
                >
                  Save
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      {image.qc_note && !needsReasons ? null : image.qc_note ? (
        <p className="truncate text-[11px] text-muted-foreground">Note: {image.qc_note}</p>
      ) : null}
    </div>
  );
}

export function ImageSelectBox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="absolute left-3 top-3 z-10 flex size-7 cursor-pointer items-center justify-center rounded-md bg-background/90 shadow-soft"
      onClick={(e) => e.stopPropagation()}
    >
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} aria-label="Select image" />
    </label>
  );
}
