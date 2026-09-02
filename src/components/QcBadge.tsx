import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import {
  QC_STATUSES,
  deriveProductQc,
  qcBreakdownText,
  qcLabel,
  updateQcStatus,
  type Product,
  type ProductImage,
  type QcStatus,
} from "@/lib/lepdo";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PASS: "bg-primary/10 text-primary",
  HOLD: "bg-gold/20 text-gold-foreground",
  REJECT: "bg-destructive/10 text-destructive",
  MIXED: "bg-amber-500/15 text-amber-700",
};

/**
 * Product QC badge. When `images` are provided, QC is derived automatically
 * from image-level QC (source of truth) and the badge becomes read-only —
 * click shows the breakdown for MIXED.
 */
export function QcBadge({
  product,
  images,
  className,
}: {
  product: Product;
  images?: ProductImage[];
  className?: string;
}) {
  const { can, audit } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const editable = can("PRODUCT_UPDATE");

  // Auto mode: derive from image QC whenever the product has images.
  const derived = images && images.length > 0 ? deriveProductQc(images) : null;
  const status = derived ? derived.status : ((product.qc_status ?? "PENDING") as QcStatus);

  const pill = (extra?: React.ReactNode) => (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wide",
        TONE[status] ?? TONE.PENDING,
        className,
      )}
    >
      QC: {status === "MIXED" ? "Mixed" : qcLabel(status)}
      {status === "PASS" && <Check className="size-3" />}
      {extra}
    </span>
  );

  // Auto-derived from image QC: read-only, with a breakdown popover.
  if (derived) {
    if (status !== "MIXED") return pill();
    return (
      <Popover>
        <PopoverTrigger onClick={(e) => e.stopPropagation()} className="focus:outline-none">
          {pill(<ChevronDown className="size-3 opacity-70" />)}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Image QC breakdown
          </p>
          <p className="mt-1.5 text-sm font-medium text-foreground">
            {qcBreakdownText(derived.breakdown)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {derived.total} images · set all images to one status to clear Mixed
          </p>
        </PopoverContent>
      </Popover>
    );
  }

  if (!editable) return pill();

  async function set(next: QcStatus) {
    if (next === status || busy) return;
    setBusy(true);
    // Optimistic: patch the cached rows so only this badge re-renders.
    const patch = (rows?: Product[]) =>
      rows?.map((r) => (r.id === product.id ? { ...r, qc_status: next } : r));
    queryClient.setQueryData(["products"], patch);
    queryClient.setQueryData(["product", product.id], (r?: Product) =>
      r ? { ...r, qc_status: next } : r,
    );
    try {
      await updateQcStatus([product.id], next);
      audit({
        action: "QC_STATUS_CHANGE",
        module: "Products",
        entityType: "product",
        entityId: product.id,
        description: `QC status changed to ${qcLabel(next)} for ${product.name}`,
        oldValues: { qc_status: status },
        newValues: { qc_status: next },
      });
      toast.success("Saved ✓", { duration: 1200 });
    } catch (e) {
      // Roll back to the previous value.
      const revert = (rows?: Product[]) =>
        rows?.map((r) => (r.id === product.id ? { ...r, qc_status: status } : r));
      queryClient.setQueryData(["products"], revert);
      queryClient.setQueryData(["product", product.id], (r?: Product) =>
        r ? { ...r, qc_status: status } : r,
      );
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy}
        onClick={(e) => e.stopPropagation()}
        className="focus:outline-none"
      >
        {pill(<ChevronDown className="size-3 opacity-70" />)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        {QC_STATUSES.map((s) => (
          <DropdownMenuItem key={s.value} onSelect={() => void set(s.value)}>
            {s.label}
            {s.value === status && <Check className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
