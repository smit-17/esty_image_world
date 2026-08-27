import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X, Bookmark, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  activeChips,
  clearChip,
  countActive,
  loadPresets,
  savePresets,
  ANY,
  DATE_PRESETS,
  DIAMOND_CLARITIES,
  DIAMOND_COLOURS,
  DIAMOND_SHAPES,
  DIAMOND_TYPES,
  EMPTY_FILTERS,
  LISTING_STATUSES,
  METAL_COLOURS,
  METAL_KARATS,
  METAL_TYPES,
  PRODUCT_TYPES,
  SORTS,
  SUBCATEGORIES,
  type Filters,
  type Preset,
  type SortKey,
} from "@/lib/filters";
import { cn } from "@/lib/utils";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Pick({
  label,
  value,
  onChange,
  options,
  anyLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly (string | { value: string; label: string })[];
  anyLabel?: string;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-xl">
          <SelectValue placeholder={anyLabel ?? `Any ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          <SelectItem value={ANY}>{anyLabel ?? `Any ${label.toLowerCase()}`}</SelectItem>
          {options.map((o) => {
            const v = typeof o === "string" ? o : o.value;
            const l = typeof o === "string" ? o : o.label;
            return (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </Field>
  );
}

function RangeField({
  label,
  suffix,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  suffix?: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label}>
      <div className="grid grid-cols-2 gap-2">
        <Input
          inputMode="decimal"
          value={min}
          onChange={(e) => onMin(e.target.value)}
          placeholder="Min"
          className="h-10 rounded-xl tabular-nums"
        />
        <Input
          inputMode="decimal"
          value={max}
          onChange={(e) => onMax(e.target.value)}
          placeholder="Max"
          className="h-10 rounded-xl tabular-nums"
        />
      </div>
    </Field>
  );
}

export function ProductFilterBar({
  scope,
  filters,
  onChange,
  categories,
  team,
  resultCount,
  totalCount,
  extra,
}: {
  scope: string;
  filters: Filters;
  onChange: (f: Filters) => void;
  categories: string[];
  team: string[];
  resultCount: number;
  totalCount: number;
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(filters);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");

  useEffect(() => setPresets(loadPresets(scope)), [scope]);
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const chips = useMemo(() => activeChips(filters), [filters]);
  const activeCount = countActive(filters);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function persist(next: Preset[]) {
    setPresets(next);
    savePresets(scope, next);
  }

  return (
    <div className="surface sticky top-2 z-20 space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            placeholder="Search by product ID, SKU, name or keyword"
            className="h-11 rounded-xl pl-9"
            aria-label="Search products"
          />
        </div>

        <Select
          value={filters.sort}
          onValueChange={(v) => onChange({ ...filters, sort: v as SortKey })}
        >
          <SelectTrigger className="h-11 w-[10.5rem] rounded-xl">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-11 gap-2 rounded-xl">
              <SlidersHorizontal className="size-4" />
              Filters
              {activeCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.65rem] leading-none text-primary-foreground tabular-nums">
                  {activeCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border px-5 py-4">
              <SheetTitle>Advanced filters</SheetTitle>
              <SheetDescription>Combine any filters, then apply.</SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <Pick
                label="Date"
                value={draft.date}
                onChange={(v) => set("date", v)}
                options={DATE_PRESETS}
                anyLabel="Any date"
              />
              {draft.date === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="From">
                    <Input
                      type="date"
                      value={draft.from}
                      onChange={(e) => set("from", e.target.value)}
                      className="h-10 rounded-xl"
                    />
                  </Field>
                  <Field label="To">
                    <Input
                      type="date"
                      value={draft.to}
                      onChange={(e) => set("to", e.target.value)}
                      className="h-10 rounded-xl"
                    />
                  </Field>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Pick
                  label="Category"
                  value={draft.category}
                  onChange={(v) => set("category", v)}
                  options={categories}
                />
                <Pick
                  label="Subcategory"
                  value={draft.subcategory}
                  onChange={(v) => set("subcategory", v)}
                  options={SUBCATEGORIES}
                />
                <Pick
                  label="Product type"
                  value={draft.productType}
                  onChange={(v) => set("productType", v)}
                  options={PRODUCT_TYPES}
                />
                <Field label="SKU">
                  <Input
                    value={draft.sku}
                    onChange={(e) => set("sku", e.target.value)}
                    placeholder="e.g. LEP-001"
                    className="h-10 rounded-xl"
                  />
                </Field>
                <Pick
                  label="Created by"
                  value={draft.member}
                  onChange={(v) => set("member", v)}
                  options={team}
                  anyLabel="Any team member"
                />
                <Pick
                  label="Listing status"
                  value={draft.listing}
                  onChange={(v) => set("listing", v)}
                  options={LISTING_STATUSES}
                  anyLabel="Any listing status"
                />
                <Pick
                  label="Weight status"
                  value={draft.weight}
                  onChange={(v) => set("weight", v)}
                  options={[
                    { value: "completed", label: "Completed" },
                    { value: "pending", label: "Pending" },
                  ]}
                  anyLabel="Any weight status"
                />
                <Pick
                  label="Metal type"
                  value={draft.metalType}
                  onChange={(v) => set("metalType", v)}
                  options={METAL_TYPES}
                />
                <Pick
                  label="Metal karat"
                  value={draft.metalKarat}
                  onChange={(v) => set("metalKarat", v)}
                  options={METAL_KARATS}
                />
                <Pick
                  label="Metal colour"
                  value={draft.metalColour}
                  onChange={(v) => set("metalColour", v)}
                  options={METAL_COLOURS}
                />
                <Pick
                  label="Diamond type"
                  value={draft.diamondType}
                  onChange={(v) => set("diamondType", v)}
                  options={DIAMOND_TYPES}
                />
                <Pick
                  label="Diamond shape"
                  value={draft.diamondShape}
                  onChange={(v) => set("diamondShape", v)}
                  options={DIAMOND_SHAPES}
                />
                <Pick
                  label="Diamond colour"
                  value={draft.diamondColour}
                  onChange={(v) => set("diamondColour", v)}
                  options={DIAMOND_COLOURS}
                />
                <Pick
                  label="Diamond clarity"
                  value={draft.diamondClarity}
                  onChange={(v) => set("diamondClarity", v)}
                  options={DIAMOND_CLARITIES}
                />
              </div>

              <RangeField
                label="Total diamond weight"
                suffix="ct"
                min={draft.caratMin}
                max={draft.caratMax}
                onMin={(v) => set("caratMin", v)}
                onMax={(v) => set("caratMax", v)}
              />
              <RangeField
                label="Metal weight"
                suffix="gm"
                min={draft.goldMin}
                max={draft.goldMax}
                onMin={(v) => set("goldMin", v)}
                onMax={(v) => set("goldMax", v)}
              />
              <RangeField
                label="Number of images"
                min={draft.imagesMin}
                max={draft.imagesMax}
                onMin={(v) => set("imagesMin", v)}
                onMax={(v) => set("imagesMax", v)}
              />

              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">Save as preset</p>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name"
                    className="h-10 rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 shrink-0 rounded-xl"
                    onClick={() => {
                      const name = presetName.trim();
                      if (!name) return;
                      persist([
                        ...presets.filter((p) => p.name !== name),
                        { id: Math.random().toString(36).slice(2), name, filters: draft },
                      ]);
                      setPresetName("");
                      toast.success(`Preset "${name}" saved`);
                    }}
                  >
                    <Bookmark className="size-4" /> Save
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-border px-5 py-4">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-full"
                onClick={() => {
                  setDraft({ ...EMPTY_FILTERS, sort: draft.sort });
                  onChange({ ...EMPTY_FILTERS, sort: filters.sort });
                }}
              >
                Reset
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-full"
                onClick={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                Apply filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 gap-2 rounded-xl">
              <Bookmark className="size-4" />
              <span className="hidden sm:inline">Presets</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Saved filter presets</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {presets.length === 0 ? (
              <DropdownMenuItem disabled>No presets yet</DropdownMenuItem>
            ) : (
              presets.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onSelect={() => onChange({ ...EMPTY_FILTERS, ...p.filters })}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Check className="size-3.5 opacity-60" />
                    {p.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete preset ${p.name}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      persist(presets.filter((x) => x.id !== p.id));
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {extra}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {resultCount} of {totalCount} products
        </span>
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(clearChip(filters, c.key))}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1",
              "text-xs font-medium text-primary transition-colors hover:bg-primary/20",
            )}
          >
            <span className="max-w-[12rem] truncate">
              {c.label}: {c.value}
            </span>
            <X className="size-3" />
          </button>
        ))}
        {chips.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort })}
            className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-primary"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
