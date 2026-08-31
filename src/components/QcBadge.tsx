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
import { useAuth } from "@/lib/auth";
import { QC_STATUSES, qcLabel, updateQcStatus, type Product, type QcStatus } from "@/lib/lepdo";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PASS: "bg-primary/10 text-primary",
  HOLD: "bg-gold/20 text-gold-foreground",
  REJECT: "bg-destructive/10 text-destructive",
};

export function QcBadge({ product, className }: { product: Product; className?: string }) {
  const { can, audit } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const status = (product.qc_status ?? "PENDING") as QcStatus;
  const editable = can("PRODUCT_UPDATE");

  const label = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wide",
        TONE[status] ?? TONE.PENDING,
        className,
      )}
    >
      QC: {qcLabel(status)}
      {status === "PASS" && <Check className="size-3" />}
      {editable && <ChevronDown className="size-3 opacity-70" />}
    </span>
  );

  if (!editable) return label;

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
      toast.success("Saved \u2713", { duration: 1200 });
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
        {label}
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
