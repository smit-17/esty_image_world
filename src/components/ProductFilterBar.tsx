import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X, Bookmark, Trash2, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  toggleMulti,
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
  QC_OPTIONS,
  SORTS,
  SUBCATEGORIES,
  WEIGHT_OPTIONS,
  type Filters,
  type MultiKey,
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

/** Compact multi-select popover used by the quick header filters. */
function MultiFilter({
  label,
  filterKey,
  options,
  filters,
  onChange,
  width = "w-56",
}: {
  label: string;
  filterKey: MultiKey;
  options: readonly (string | { value: string; label: string })[];
  filters: Filters;
  onChange: (f: Filters) => void;
  width?: string;
}) {
  const selected = filters[filterKey] ?? [];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 gap-1.5 rounded-full px-3 text-sm",
            selected.length > 0 && "border-primary/40 bg-primary/10 text-primary",
          )}
        >
          {label}
          {selected.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[0.65rem] leading-4 tabular-nums text-primary-foreground">
              {selected.length}
            </span>
          )}
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("max-h-72 overflow-y-auto p-1.5", width)}>
        {options.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No options</p>
        )}
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          const on = selected.includes(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(toggleMulti(filters, filterKey, v))}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <Checkbox checked={on} className="pointer-events-none" />
              <span className="truncate">{l}</span>
            </button>
          );
        })}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, [filterKey]: [] })}
            className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
          >
            Clear {label.toLowerCase()}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Compact date popover (single choice + custom range). */
function DateFilter({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const active = filters.date !== ANY;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 gap-1.5 rounded-full px-3 text-sm",
            active && "border-primary/40 bg-primary/10 text-primary",
          )}
        >
          Date
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2 p-2">
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => onChange({ ...filters, date: ANY, from: "", to: "" })}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            Any date {filters.date === ANY && <Check className="size-3.5" />}
          </button>
          {DATE_PRESETS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => onChange({ ...filters, date: d.value })}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              {d.label} {filters.date === d.value && <Check className="size-3.5" />}
            </button>
          ))}
        </div>
        {filters.date === "custom" && (
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => onChange({ ...filters, from: e.target.value })}
              className="h-9 rounded-lg"
            />
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => onChange({ ...filters, to: e.target.value })}
              className="h-9 rounded-lg"
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
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

  // Debounced search: type freely, results recompute 250ms after the last key.
  const [q, setQ] = useState(filters.q);
  useEffect(() => setQ(filters.q), [filters.q]);
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => onChange({ ...filters, q }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

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
    <div className="surface sticky top-2 z-20 space-y-2.5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
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

      {/* Quick header filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        <MultiFilter
          label="QC"
          filterKey="qc"
          options={QC_OPTIONS}
          filters={filters}
          onChange={onChange}
        />
        <MultiFilter
          label="Listing"
          filterKey="listing"
          options={LISTING_STATUSES}
          filters={filters}
          onChange={onChange}
        />
        <MultiFilter
          label="Created by"
          filterKey="member"
          options={team}
          filters={filters}
          onChange={onChange}
          width="w-64"
        />
        <MultiFilter
          label="Weight"
          filterKey="weight"
          options={WEIGHT_OPTIONS}
          filters={filters}
          onChange={onChange}
        />
        <DateFilter filters={filters} onChange={onChange} />

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-9 gap-1.5 rounded-full px-3 text-sm">
              <SlidersHorizontal className="size-3.5" />
              More filters
              {activeCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[0.65rem] leading-4 tabular-nums text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border px-5 py-4">
              <SheetTitle>More filters</SheetTitle>
              <SheetDescription>Less-used filters, grouped by section.</SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <section className="space-y-3">
                <p className="text-eyebrow">Product</p>
                <div className="grid gap-3 sm:grid-cols-2">
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
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-eyebrow">Metal</p>
                <div className="grid gap-3 sm:grid-cols-2">
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
                </div>
                <RangeField
                  label="Metal weight"
                  suffix="gm"
                  min={draft.goldMin}
                  max={draft.goldMax}
                  onMin={(v) => set("goldMin", v)}
                  onMax={(v) => set("goldMax", v)}
                />
              </section>

              <section className="space-y-3">
                <p className="text-eyebrow">Diamond</p>
                <div className="grid gap-3 sm:grid-cols-2">
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
                  label="Diamond weight"
                  suffix="ct"
                  min={draft.caratMin}
                  max={draft.caratMax}
                  onMin={(v) => set("caratMin", v)}
                  onMax={(v) => set("caratMax", v)}
                />
              </section>

              <section className="space-y-3">
                <p className="text-eyebrow">Images</p>
                <RangeField
                  label="Number of images"
                  min={draft.imagesMin}
                  max={draft.imagesMax}
                  onMin={(v) => set("imagesMin", v)}
                  onMax={(v) => set("imagesMax", v)}
                />
              </section>

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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {resultCount} products found
        </span>
        <span className="text-xs text-muted-foreground/70 tabular-nums">of {totalCount}</span>
        {chips.map((c) => (
          <button
            key={`${c.key}:${c.item ?? ""}`}
            type="button"
            onClick={() => onChange(clearChip(filters, c.key, c.item))}
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
