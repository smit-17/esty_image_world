import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ---------------- layout ---------------- */

export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="text-xl font-semibold text-primary lg:text-2xl">{title}</h1>
      {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card p-2">
      {children}
    </div>
  );
}

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {action}
    </div>
  );
}

export function Pager({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return <p className="text-xs text-muted-foreground">{total} record(s)</p>;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-[12px]"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page} of {pageCount} · {total} record(s)
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-[12px]"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

/* ---------------- pills ---------------- */

const STATUS_STYLES: Record<string, string> = {
  unassigned: "bg-muted text-muted-foreground",
  assigned: "bg-primary/10 text-primary",
  in_progress: "bg-amber-100 text-amber-800",
  moved: "bg-emerald-100 text-emerald-800",
  done: "bg-emerald-100 text-emerald-800",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-muted text-muted-foreground",
};

export function PriorityPill({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        PRIORITY_STYLES[priority] ?? "bg-muted text-muted-foreground",
      )}
    >
      {priority} priority
    </span>
  );
}

/* ---------------- form bits ---------------- */

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

type Option = string | { value: string; label: string };

export function Picker({
  value,
  options,
  onChange,
  labelPrefix,
  placeholder,
  className,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  labelPrefix?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 rounded-lg border border-input bg-background px-2 text-xs capitalize outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o.replace(/_/g, " ") : o.label;
        return (
          <option key={v} value={v}>
            {labelPrefix ? `${labelPrefix}: ${l}` : l}
          </option>
        );
      })}
    </select>
  );
}

/* ---------------- images ---------------- */

/** Plain remote image with a graceful placeholder — used for extracted URLs. */
export function SmartImage({
  src,
  label,
  lazy = true,
  showFailure = false,
  onClick,
}: {
  src?: string | null;
  label?: string;
  lazy?: boolean;
  showFailure?: boolean;
  onClick?: () => void;
}) {
  if (!src) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-border bg-secondary text-[11px] text-muted-foreground">
        {showFailure ? "No image" : <ImageIcon className="size-5" strokeWidth={1.5} />}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={label ?? ""}
      loading={lazy ? "lazy" : "eager"}
      decoding="async"
      onClick={onClick}
      className="aspect-square w-full rounded-lg border border-border bg-secondary object-cover"
    />
  );
}
