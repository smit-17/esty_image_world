import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ExternalLink, Link2, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  Field,
  PageHeader,
  Pager,
  Picker,
  PriorityPill,
  SectionCard,
  SmartImage,
  StatusPill,
  Toolbar,
} from "@/components/finding/ui";
import { ImageUploadArea } from "@/components/finding/ImageUploadArea";
import { RefImage, isImageRef } from "@/components/finding/RefImage";
import { useAuth } from "@/lib/auth";
import {
  FINDING_CATEGORIES,
  FINDING_PLATFORMS,
  FINDING_PRIORITIES,
  FINDING_STATUSES,
  createFinding,
  deleteFinding,
  fetchFindingMembers,
  fetchFindingOptions,
  fetchFindings,
  findingImages,
  mainImageOf,
  nextFindingCode,
  normalizePriority,
  normalizeStatus,
  optionValues,
  updateFinding,
  type Finding,
  type FindingExtra,
  type FindingInput,
} from "@/lib/findings";
import {
  FIELD_LABELS,
  FIELD_SECTIONS,
  NOT_FOUND,
  fetchProductData,
  type FieldKey,
  type LogEntry,
} from "@/lib/fetch-product-data.functions";
import {
  backfillFindingProducts,
  createProductFromFinding,
} from "@/lib/finding-product.functions";


type Mode = "list" | "link" | "manual";
const PAGE_SIZE = 12;
const PRIO_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const daysAgo = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86400000;
const skuNum = (f: Finding) => Number(String(f.code ?? "").replace(/\D+/g, "")) || 0;

export const Route = createFileRoute("/_app/finding")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s["mode"] as Mode) || "list",
    view: (s["view"] as string) || "all",
    q: (s["q"] as string) || "",
    platform: (s["platform"] as string) || "all",
    category: (s["category"] as string) || "all",
    brand: (s["brand"] as string) || "all",
    priority: (s["priority"] as string) || "all",
    status: (s["status"] as string) || "all",
    fperson: (s["fperson"] as string) || "all",
    person: (s["person"] as string) || "all",
    assigned: (s["assigned"] as string) || "all",
    date: (s["date"] as string) || "all",
    sort: (s["sort"] as string) || "newest",
    more: (s["more"] as string) || "0",
  }),
  head: () => ({
    meta: [
      { title: "Finding — LEPDO Lifestyle Product Management" },
      {
        name: "description",
        content: "Add findings by link or manually, filter them and assign work to the team.",
      },
      { property: "og:title", content: "Finding — LEPDO Lifestyle Product Management" },
      {
        property: "og:description",
        content: "Add findings by link or manually, filter them and assign work to the team.",
      },
    ],
  }),
  component: FindingPage,
});

type SearchShape = ReturnType<typeof Route.useSearch>;

function FindingPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/finding" });
  const queryClient = useQueryClient();
  const { can, profile } = useAuth();
  const me = profile?.full_name ?? profile?.username ?? "Unknown";

  const { data: findings = [] } = useQuery({ queryKey: ["findings"], queryFn: fetchFindings });
  const { data: members = [] } = useQuery({
    queryKey: ["finding-members"],
    queryFn: fetchFindingMembers,
  });
  const { data: options = [] } = useQuery({
    queryKey: ["finding-options"],
    queryFn: fetchFindingOptions,
  });

  const people = useMemo(() => {
    const names = members.map((m) => m.name).filter(Boolean);
    return names.length ? names : [me];
  }, [members, me]);
  const categories = optionValues(options, "category", FINDING_CATEGORIES);
  const platforms = optionValues(options, "platform", FINDING_PLATFORMS);

  const canDelete = can("FINDING_DELETE");
  const canAdd = can("FINDING_ADD");
  const canUpdate = can("FINDING_UPDATE");

  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{
    finding: string;
    code: string;
    product: { productId: string; productName: string };
  } | null>(null);

  const toProduct = useServerFn(createProductFromFinding);
  const backfill = useServerFn(backfillFindingProducts);
  const [syncing, setSyncing] = useState(false);
  const canAddProduct = can("PRODUCT_ADD");

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["findings"] });

  const setSearch = (patch: Partial<SearchShape>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const brands = useMemo(
    () => Array.from(new Set(findings.map((f) => f.brand).filter(Boolean) as string[])).sort(),
    [findings],
  );

  const filtered = useMemo(() => {
    const term = search.q.trim().toLowerCase();
    const list = findings.filter((f) => {
      const status = normalizeStatus(f);
      if (search.view === "mine" && f.assigned_to !== me) return false;
      if (search.view === "unassigned" && f.assigned_to) return false;
      if (search.view === "inprogress" && status !== "in_progress") return false;
      if (search.platform !== "all" && f.platform !== search.platform) return false;
      if (search.category !== "all" && f.category !== search.category) return false;
      if (search.brand !== "all" && f.brand !== search.brand) return false;
      if (search.priority !== "all" && normalizePriority(f.priority) !== search.priority) return false;
      if (search.status !== "all" && status !== search.status) return false;
      if (search.fperson !== "all" && f.finding_by !== search.fperson) return false;
      if (search.person !== "all" && (f.assigned_to ?? "") !== search.person) return false;
      if (search.assigned === "assigned" && !f.assigned_to) return false;
      if (search.assigned === "unassigned" && f.assigned_to) return false;
      if (search.date !== "all" && daysAgo(f.created_at) > Number(search.date)) return false;
      if (!term) return true;
      return [f.code, f.title, f.brand, f.product_url, f.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
    return [...list].sort((a, b) => {
      if (search.sort === "oldest") return a.created_at.localeCompare(b.created_at);
      if (search.sort === "priority")
        return (PRIO_RANK[normalizePriority(a.priority)] ?? 1) - (PRIO_RANK[normalizePriority(b.priority)] ?? 1);
      if (search.sort === "sku") return skuNum(a) - skuNum(b);
      return b.created_at.localeCompare(a.created_at);
    });
  }, [findings, search, me]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const patch = useMutation({
    mutationFn: async ({
      finding,
      values,
      activity,
    }: {
      finding: Finding;
      values: FindingInput;
      activity?: string;
    }) => updateFinding(finding, values, activity ?? "Finding edited"),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = async (f: Finding, value: string) => {
    if (!canUpdate) return toast.error("Your role does not allow updating findings.");
    const assignee = value === "none" ? null : value;
    await patch.mutateAsync({
      finding: f,
      values: { assigned_to: assignee, status: assignee ? "assigned" : "unassigned" },
      activity: assignee ? `Assigned to ${assignee}` : "Assignment removed",
    });
  };

  const bulk = async (fn: (f: Finding) => Promise<unknown>, label: string) => {
    const list = findings.filter((f) => selected.includes(f.id));
    await Promise.all(list.map(fn));
    toast.success(`${list.length} finding(s) ${label}`);
    setSelected([]);
    invalidate();
  };

  const askDelete = (ids: string[]) => {
    if (!canDelete) return toast.error("You do not have permission to delete findings.");
    if (ids.length) setConfirmIds(ids);
  };

  const confirmDelete = async () => {
    const ids = confirmIds ?? [];
    setConfirmIds(null);
    const list = findings.filter((f) => ids.includes(f.id));
    try {
      await Promise.all(list.map((f) => deleteFinding(f)));
      toast.success(`${list.length} finding(s) deleted`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSelected((s) => s.filter((id) => !ids.includes(id)));
    invalidate();
  };

  const save = async (input: FindingInput): Promise<void> => {
    if (!canAdd) {
      toast.error("Your role does not allow adding findings.");
      return;
    }
    try {
      const code = input.code || (await nextFindingCode());
      const created = await createFinding({ ...input, code });
      invalidate();
      setSearch({ mode: "list" });

      const pending = toast.loading(`Finding ${created.code} saved — adding it to Products…`);
      try {
        const out = await toProduct({ data: { findingId: created.id } });
        void queryClient.invalidateQueries({ queryKey: ["products"] });
        void queryClient.invalidateQueries({ queryKey: ["images", "all"] });
        const open = {
          label: "View Product",
          onClick: () => void navigate({ to: "/products/$id", params: { id: out.productId } }),
        };
        if (out.status === "duplicate") {
          toast.warning("This item is already in Products.", {
            id: pending,
            description: out.productName,
            action: open,
            duration: 10000,
          });
          setDuplicate({ finding: created.id, code: created.code, product: out });
          return;
        }
        toast.success(`Product created with ${out.imagesCopied} image(s)`, {
          id: pending,
          description: out.imagesFailed ? `${out.imagesFailed} image(s) could not be copied.` : out.productName,
          action: open,
          duration: 10000,
        });
      } catch (e) {
        toast.error(`Finding saved, but the product was not created: ${(e as Error).message}`, {
          id: pending,
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const chips = (
    [
      ["platform", search.platform],
      ["category", search.category],
      ["brand", search.brand],
      ["priority", search.priority],
      ["status", search.status],
      ["found by", search.fperson],
      ["assigned to", search.person],
      ["assignment", search.assigned],
      ["added", search.date === "all" ? "all" : `last ${search.date}d`],
    ] as const
  ).filter(([, v]) => v !== "all");

  const chipKey: Record<string, keyof SearchShape> = {
    platform: "platform",
    category: "category",
    brand: "brand",
    priority: "priority",
    status: "status",
    "found by": "fperson",
    "assigned to": "person",
    assignment: "assigned",
    added: "date",
  };

  const clearAll = () =>
    setSearch({
      q: "",
      platform: "all",
      category: "all",
      brand: "all",
      priority: "all",
      status: "all",
      fperson: "all",
      person: "all",
      assigned: "all",
      date: "all",
    });

  const openedFinding = findings.find((f) => f.id === opened) ?? null;

  return (
    <div className="w-full space-y-3">
      <PageHeader
        title="Finding"
        meta={`${findings.length} records`}
        actions={
          search.mode === "list" ? (
            canAdd ? (
              <>
                <Button size="sm" variant="outline" className="h-9" onClick={() => setSearch({ mode: "link" })}>
                  <Link2 className="size-4" /> By Link
                </Button>
                <Button size="sm" className="h-9" onClick={() => setSearch({ mode: "manual" })}>
                  <Plus className="size-4" /> Manual Add
                </Button>
              </>
            ) : null
          ) : (
            <Button size="sm" variant="outline" className="h-9" onClick={() => setSearch({ mode: "list" })}>
              Back to findings
            </Button>
          )
        }
      />

      {search.mode === "link" ? (
        <ByLinkFlow
          findings={findings}
          people={people}
          platforms={platforms}
          categories={categories}
          me={me}
          onSave={save}
          onOpen={(id) => setOpened(id)}
        />
      ) : search.mode === "manual" ? (
        <ManualForm
          people={people}
          platforms={platforms}
          categories={categories}
          me={me}
          existingLinks={findings.map((f) => f.product_url ?? "")}
          onCancel={() => setSearch({ mode: "list" })}
          onSave={save}
        />
      ) : (
        <>
          <Toolbar>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "All"],
                  ["mine", "Assigned to me"],
                  ["unassigned", "Unassigned"],
                  ["inprogress", "In Progress"],
                ] as const
              ).map(([v, label]) => (
                <Button
                  key={v}
                  size="sm"
                  variant={search.view === v ? "default" : "outline"}
                  className="h-8 text-[12px]"
                  onClick={() => setSearch({ view: v })}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Input
              value={search.q}
              placeholder="Search SKU, title, brand or URL…"
              onChange={(e) => setSearch({ q: e.target.value })}
              className="h-9 w-full max-w-60 text-sm"
            />
            <Picker
              className="w-36"
              value={search.platform}
              onChange={(v) => setSearch({ platform: v })}
              options={["all", ...platforms]}
              labelPrefix="Platform"
            />
            <Picker
              className="w-36"
              value={search.category}
              onChange={(v) => setSearch({ category: v })}
              options={["all", ...categories]}
              labelPrefix="Category"
            />
            <Picker
              className="w-32"
              value={search.priority}
              onChange={(v) => setSearch({ priority: v })}
              options={["all", ...FINDING_PRIORITIES]}
              labelPrefix="Priority"
            />
            <Picker
              className="w-36"
              value={search.sort}
              onChange={(v) => setSearch({ sort: v })}
              options={[
                { value: "newest", label: "Newest" },
                { value: "oldest", label: "Oldest" },
                { value: "priority", label: "Priority" },
                { value: "sku", label: "SKU" },
              ]}
              labelPrefix="Sort"
            />
            <Button
              size="sm"
              variant={search.more === "1" ? "default" : "outline"}
              className="h-9 text-[12px]"
              onClick={() => setSearch({ more: search.more === "1" ? "0" : "1" })}
            >
              <SlidersHorizontal className="size-4" /> More Filters
            </Button>
          </Toolbar>

          {search.more === "1" ? (
            <Toolbar>
              <Picker
                className="w-40"
                value={search.brand}
                onChange={(v) => setSearch({ brand: v })}
                options={["all", ...brands]}
                labelPrefix="Brand"
              />
              <Picker
                className="w-40"
                value={search.fperson}
                onChange={(v) => setSearch({ fperson: v })}
                options={["all", ...people]}
                labelPrefix="Found by"
              />
              <Picker
                className="w-40"
                value={search.person}
                onChange={(v) => setSearch({ person: v })}
                options={["all", ...people]}
                labelPrefix="Assigned to"
              />
              <Picker
                className="w-40"
                value={search.assigned}
                onChange={(v) => setSearch({ assigned: v })}
                options={["all", "assigned", "unassigned"]}
                labelPrefix="Assignment"
              />
              <Picker
                className="w-40"
                value={search.status}
                onChange={(v) => setSearch({ status: v })}
                options={["all", ...FINDING_STATUSES]}
                labelPrefix="Status"
              />
              <Picker
                className="w-40"
                value={search.date}
                onChange={(v) => setSearch({ date: v })}
                options={[
                  { value: "all", label: "Any date" },
                  { value: "7", label: "Last 7 days" },
                  { value: "30", label: "Last 30 days" },
                  { value: "90", label: "Last 90 days" },
                ]}
                labelPrefix="Added"
              />
            </Toolbar>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="text-muted-foreground">{filtered.length} result(s)</span>
            {search.q.trim() ? (
              <button
                className="rounded-full bg-accent px-2.5 py-1 text-accent-foreground"
                onClick={() => setSearch({ q: "" })}
              >
                search: {search.q} ✕
              </button>
            ) : null}
            {chips.map(([k, v]) => (
              <button
                key={k}
                className="rounded-full bg-accent px-2.5 py-1 capitalize text-accent-foreground"
                onClick={() => setSearch({ [chipKey[k]!]: "all" } as Partial<SearchShape>)}
              >
                {k}: {v} ✕
              </button>
            ))}
            {chips.length || search.q.trim() ? (
              <button
                className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground"
                onClick={clearAll}
              >
                Clear All
              </button>
            ) : null}
          </div>

          {selected.length ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-accent/50 p-2 text-[13px]">
              <span className="font-medium">{selected.length} selected</span>
              <Picker
                className="w-44"
                value=""
                placeholder="Assign / Reassign…"
                options={people}
                onChange={(v) => void bulk((f) => assign(f, v), `assigned to ${v}`)}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={() => void bulk((f) => assign(f, "none"), "unassigned")}
              >
                Remove Assignment
              </Button>
              <Picker
                className="w-40"
                value=""
                placeholder="Priority…"
                options={FINDING_PRIORITIES}
                onChange={(v) =>
                  void bulk(
                    (f) => patch.mutateAsync({ finding: f, values: { priority: v }, activity: `Priority set to ${v}` }),
                    "updated",
                  )
                }
              />
              <Picker
                className="w-40"
                value=""
                placeholder="Status…"
                options={FINDING_STATUSES}
                onChange={(v) =>
                  void bulk(
                    (f) => patch.mutateAsync({ finding: f, values: { status: v }, activity: `Status changed to ${v}` }),
                    "updated",
                  )
                }
              />
              {canDelete ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-destructive/40 text-[12px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => askDelete(selected)}
                >
                  <Trash2 className="size-3.5" /> Delete Selected
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected([])}>
                Clear Selection
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[12px]"
              onClick={() => setSelected((s) => Array.from(new Set([...s, ...rows.map((r) => r.id)])))}
            >
              Select Page ({rows.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[12px]"
              onClick={() => setSelected(filtered.map((r) => r.id))}
            >
              Select All Filtered ({filtered.length})
            </Button>
            {canAddProduct ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[12px]"
                disabled={syncing}
                onClick={() => {
                  setSyncing(true);
                  void (async () => {
                    try {
                      const out = await backfill({ data: undefined });
                      await queryClient.invalidateQueries({ queryKey: ["products"] });
                      await queryClient.invalidateQueries({ queryKey: ["images", "all"] });
                      toast.success(
                        out.created
                          ? `${out.created} finding(s) added to Products.`
                          : "Every finding already has a product.",
                      );
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setSyncing(false);
                    }
                  })();
                }}
              >
                {syncing ? "Syncing…" : "Sync to Products"}
              </Button>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No findings match these filters."
              hint="Try Clear All, or add a finding by link."
              action={
                canAdd ? (
                  <Button size="sm" className="h-9" onClick={() => setSearch({ mode: "link" })}>
                    <Link2 className="size-4" /> By Link
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((f) => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  people={people}
                  checked={selected.includes(f.id)}
                  onCheck={(v) => setSelected((s) => (v ? [...s, f.id] : s.filter((x) => x !== f.id)))}
                  onAssign={(v) => void assign(f, v)}
                  onOpen={() => setOpened(f.id)}
                  {...(canDelete ? { onDelete: () => askDelete([f.id]) } : {})}
                />
              ))}
            </div>
          )}

          <Pager page={current} pageCount={pageCount} total={filtered.length} onChange={setPage} />
        </>
      )}

      <Dialog open={Boolean(duplicate)} onOpenChange={(o) => !o && setDuplicate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Product already exists</DialogTitle>
            <DialogDescription className="text-[13px]">
              “{duplicate?.product.productName}” already covers this source link, listing ID or SKU, so
              a duplicate was not created. The finding {duplicate?.code} was still saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setDuplicate(null)}>
              Close
            </Button>
            {canAddProduct ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const dup = duplicate;
                  setDuplicate(null);
                  if (!dup) return;
                  void (async () => {
                    try {
                      const out = await toProduct({ data: { findingId: dup.finding, force: true } });
                      void queryClient.invalidateQueries({ queryKey: ["products"] });
                      toast.success(`Product created with ${out.imagesCopied} image(s)`, {
                        action: {
                          label: "View Product",
                          onClick: () =>
                            void navigate({ to: "/products/$id", params: { id: out.productId } }),
                        },
                      });
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  })();
                }}
              >
                Create another anyway
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => {
                const id = duplicate?.product.productId;
                setDuplicate(null);
                if (id) void navigate({ to: "/products/$id", params: { id } });
              }}
            >
              View Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmIds)} onOpenChange={(o) => !o && setConfirmIds(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Delete {confirmIds?.length ?? 0} finding{(confirmIds?.length ?? 0) === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Only the finding record and its reference images are deleted. Products, AI images,
              quotations and descriptions are never removed.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-40 overflow-y-auto text-[12px] text-muted-foreground">
            {(confirmIds ?? []).slice(0, 8).map((id) => {
              const f = findings.find((x) => x.id === id);
              return <li key={id}>{f ? `${f.code} — ${f.title ?? "Untitled"}` : id}</li>;
            })}
            {(confirmIds?.length ?? 0) > 8 ? <li>…and {(confirmIds?.length ?? 0) - 8} more</li> : null}
          </ul>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setConfirmIds(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void confirmDelete()}>
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(openedFinding)} onOpenChange={(o) => !o && setOpened(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {openedFinding ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">
                  {openedFinding.title ?? openedFinding.code}
                </DialogTitle>
              </DialogHeader>
              <FindingDetail
                finding={openedFinding}
                people={people}
                categories={categories}
                readOnly={!canUpdate}
                onSave={async (values) => {
                  await patch.mutateAsync({ finding: openedFinding, values });
                  toast.success("Finding updated");
                  setOpened(null);
                }}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- card ---------------- */

function FindingCard({
  finding: f,
  people,
  checked,
  onCheck,
  onAssign,
  onOpen,
  onDelete,
}: {
  finding: Finding;
  people: string[];
  checked: boolean;
  onCheck: (v: boolean) => void;
  onAssign: (v: string) => void;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const main = mainImageOf(f);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5">
      <div className="relative">
        <div className="aspect-square w-full overflow-hidden rounded-lg border border-border bg-secondary">
          {isImageRef(main) ? (
            <RefImage refSrc={main} alt={f.title ?? f.code} />
          ) : (
            <SmartImage label={f.category ?? ""} />
          )}
        </div>
        <span className="absolute left-1.5 top-1.5 rounded-md bg-card/90 p-1">
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => onCheck(Boolean(v))}
            aria-label={`Select ${f.code}`}
          />
        </span>
        {onDelete ? (
          <button
            aria-label={`Delete ${f.code}`}
            title="Delete finding"
            onClick={onDelete}
            className="absolute right-1.5 top-1.5 rounded-md bg-card/90 p-1.5 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>

      <p className="truncate text-[13px] font-semibold text-primary" title={f.code}>
        {f.code}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill status={normalizeStatus(f)} />
        <PriorityPill priority={normalizePriority(f.priority)} />
      </div>

      <details className="group min-w-0 rounded-md bg-muted/40 px-2 py-1">
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-muted-foreground">
          Details
        </summary>
        <div className="mt-1.5 space-y-1.5">
          <p className="break-words text-[12px] leading-snug">
            <span className="font-semibold text-muted-foreground">Source title: </span>
            {f.title ?? "—"}
          </p>
          <p className="break-words text-[11px] text-muted-foreground">
            {f.platform} · {f.category ?? "—"}
          </p>
          <Picker
            className="h-8 w-full"
            value={f.assigned_to ?? "none"}
            options={["none", ...people]}
            onChange={onAssign}
            labelPrefix="Assign"
          />
          {f.note ? <p className="break-words text-[11px] text-muted-foreground">{f.note}</p> : null}
        </div>
      </details>

      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" variant="outline" className="h-8 px-1 text-[11px]" onClick={onOpen}>
          View / Edit
        </Button>
        <Button asChild size="sm" variant="outline" className="h-8 px-1 text-[11px]">
          <a href={f.product_url || "#"} target="_blank" rel="noreferrer">
            Source
          </a>
        </Button>
      </div>
    </div>
  );
}

/* ---------------- detail ---------------- */

function FindingImages({ finding }: { finding: Finding }) {
  const refs = findingImages(finding);
  const [active, setActive] = useState(refs[0] ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const current = refs.includes(active) ? active : (refs[0] ?? "");

  if (!refs.length) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-border bg-secondary text-[12px] text-muted-foreground">
        No image added
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-secondary">
        <RefImage refSrc={current} alt={finding.title ?? finding.code} kind="full" onClick={(u) => setPreview(u)} />
      </div>
      {refs.length > 1 ? (
        <div className="grid grid-cols-5 gap-1.5">
          {refs.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setActive(r)}
              className={`aspect-square overflow-hidden rounded-md border bg-secondary ${
                r === current ? "border-primary ring-1 ring-ring" : "border-border"
              }`}
            >
              <RefImage refSrc={r} alt="Reference image" />
            </button>
          ))}
        </div>
      ) : null}
      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm">{finding.title ?? finding.code}</DialogTitle>
          </DialogHeader>
          {preview ? (
            <img src={preview} alt={finding.title ?? finding.code} className="max-h-[70vh] w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FindingDetail({
  finding,
  people,
  categories,
  readOnly,
  onSave,
}: {
  finding: Finding;
  people: string[];
  categories: string[];
  readOnly: boolean;
  onSave: (values: FindingInput) => Promise<void> | void;
}) {
  const [form, setForm] = useState({
    title: finding.title ?? "",
    brand: finding.brand ?? "",
    category: finding.category ?? categories[0] ?? "",
    priority: normalizePriority(finding.priority),
    assigned_to: finding.assigned_to ?? "none",
    note: finding.note ?? "",
  });
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const extra = Array.isArray(finding.extra) ? finding.extra : [];

  return (
    <div className="space-y-3">
      <FindingImages finding={finding} />
      <p className="text-[12px] text-muted-foreground">
        {finding.code} · {finding.platform} · added {new Date(finding.created_at).toLocaleDateString()}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">
          <Input value={form.title} onChange={(e) => set({ title: e.target.value })} className="h-9 text-sm" />
        </Field>
        <Field label="Brand / shop">
          <Input value={form.brand} onChange={(e) => set({ brand: e.target.value })} className="h-9 text-sm" />
        </Field>
        <Field label="Category">
          <Picker className="w-full" value={form.category} options={categories} onChange={(v) => set({ category: v })} />
        </Field>
        <Field label="Priority">
          <Picker
            className="w-full"
            value={form.priority}
            options={FINDING_PRIORITIES}
            onChange={(v) => set({ priority: v })}
          />
        </Field>
        <Field label="Assigned person">
          <Picker
            className="w-full"
            value={form.assigned_to}
            options={["none", ...people]}
            onChange={(v) => set({ assigned_to: v })}
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={form.note} onChange={(e) => set({ note: e.target.value })} className="text-sm" />
        </Field>
      </div>

      {extra.length ? (
        <Accordion type="single" collapsible className="rounded-lg border border-border px-2">
          {Array.from(new Set(extra.map((x) => x.section))).map((section) => (
            <AccordionItem key={section} value={section}>
              <AccordionTrigger className="text-[13px]">{section}</AccordionTrigger>
              <AccordionContent>
                <dl className="grid gap-1 text-[12px] sm:grid-cols-2">
                  {extra
                    .filter((x) => x.section === section)
                    .map((x) => (
                      <div key={x.label} className="flex min-w-0 gap-1">
                        <dt className="shrink-0 text-muted-foreground">{x.label}:</dt>
                        <dd className="min-w-0 break-words">{x.value}</dd>
                      </div>
                    ))}
                </dl>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {readOnly ? null : (
          <Button
            size="sm"
            className="h-9"
            onClick={() =>
              void onSave({
                title: form.title,
                brand: form.brand,
                category: form.category,
                priority: form.priority,
                note: form.note,
                assigned_to: form.assigned_to === "none" ? null : form.assigned_to,
                status: form.assigned_to === "none" ? "unassigned" : "assigned",
              })
            }
          >
            Save changes
          </Button>
        )}
        <Button asChild size="sm" variant="outline" className="h-9">
          <a href={finding.product_url || "#"} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" /> Source
          </a>
        </Button>
      </div>
    </div>
  );
}

/* ---------------- by link ---------------- */

type Extracted = {
  title: string;
  sku: string;
  sourceSku: string;
  platform: string;
  category: string;
  brand: string;
  productLink: string;
  notes: string;
  seeds: string[];
  main: string;
  extra: FindingExtra[];
  missing: string[];
};

const normalizedLink = (raw: string) => {
  try {
    const url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ref"].forEach((k) =>
      url.searchParams.delete(k),
    );
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
};

function guessPlatform(host: string, platforms: string[]) {
  const h = host.toLowerCase();
  return platforms.find((p) => h.includes(p.split(" ")[0]!.toLowerCase())) ?? platforms[0] ?? "Other";
}

function guessCategory(text: string, categories: string[]) {
  const t = text.toLowerCase();
  return categories.find((c) => t.includes(c.toLowerCase())) ?? "";
}

function ByLinkFlow({
  findings,
  people,
  platforms,
  categories,
  me,
  onSave,
  onOpen,
}: {
  findings: Finding[];
  people: string[];
  platforms: string[];
  categories: string[];
  me: string;
  onSave: (input: FindingInput) => Promise<void> | void;
  onOpen: (id: string) => void;
}) {
  const extract = useServerFn(fetchProductData);
  const [link, setLink] = useState("");
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Extracted | null>(null);
  const [status, setStatus] = useState<"complete" | "partial" | "failed" | null>(null);
  const [reason, setReason] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [priority, setPriority] = useState("medium");
  const [assigned, setAssigned] = useState("none");
  const [findingPerson, setFindingPerson] = useState(people[0] ?? me);
  const [manualImage, setManualImage] = useState("");
  const [pasted, setPasted] = useState("");

  const duplicate = findings.find(
    (f) => link.trim() && normalizedLink(f.product_url ?? "") === normalizedLink(link),
  );
  const blockedByDuplicate = Boolean(duplicate) && !allowDuplicate;

  const fetchDetails = async (pastedHtml?: string) => {
    if (!link.trim()) return toast.error("Paste a product link first.");
    if (blockedByDuplicate) return;
    setBusy(true);
    setStatus(null);
    setReason("");
    setLog([]);
    try {
      const url = link.trim().startsWith("http") ? link.trim() : `https://${link.trim()}`;
      const r = await extract({ data: { url, ...(pastedHtml?.trim() ? { html: pastedHtml } : {}) } });

      const F = r.data.fields;
      const val = (k: FieldKey) => {
        const f = F[k];
        return f && f.value && f.value !== NOT_FOUND ? f.value : "";
      };
      const row = (section: string, k: FieldKey): FindingExtra => {
        const v = val(k);
        const src = F[k]?.source;
        return {
          section,
          label: FIELD_LABELS[k],
          value: v ? (src ? `${v}  ·  ${src}` : v) : NOT_FOUND,
        };
      };

      let host = "";
      try {
        host = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        host = "";
      }

      const shown: FieldKey[] = (Object.keys(FIELD_LABELS) as FieldKey[]).filter(
        (k) => !["title", "brand", "platform", "canonicalUrl"].includes(k) && val(k),
      );
      const extra: FindingExtra[] = [
        { section: "Product Details", label: "Source host", value: host || "—" },
        ...shown.map((k) => row(FIELD_SECTIONS[k], k)),
        { section: "Product Details", label: "Tags", value: r.data.tags.join(", ") || NOT_FOUND },
        { section: "Notes & Additional Information", label: "Extraction result", value: r.message },
      ];


      const images = r.data.images.map((i) => i.url);
      const required: [string, string][] = [
        ["title", val("title")],
        ["price", val("price")],
        ["brand", val("brand")],
        ["description", val("description")],
      ];
      const missing = required.filter(([, v]) => !v).map(([k]) => k);
      if (!images.length) missing.push("images");

      setLog(r.log);
      if (!r.ok) {
        setStatus("failed");
        setReason(r.message);
        setResult(null);
        return;
      }
      setStatus(missing.length ? "partial" : "complete");
      setReason(r.message);
      setResult({
        title: val("title"),
        sku: "",
        sourceSku: val("sku"),
        platform: guessPlatform(val("platform") || host, platforms),
        category:
          val("category") || guessCategory(`${val("title")} ${val("description")}`, categories) || categories[0] || "",
        brand: val("brand"),
        productLink: val("canonicalUrl") || r.data.sourceUrl || url,
        notes: val("description"),
        seeds: images,
        main: images[0] ?? "",
        extra,
        missing,
      });
    } catch (e) {
      setStatus("failed");
      setReason(e instanceof Error ? e.message : "The link could not be read.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const set = (p: Partial<Extracted>) => setResult((r) => (r ? { ...r, ...p } : r));

  const copyAll = async () => {
    if (!result) return;
    const lines: string[] = [];
    const add = (label: string, value?: string | null) => {
      const v = value?.trim();
      if (!v || v === NOT_FOUND || v === "—") return;
      lines.push(`${label}: ${v}`);
    };
    add("Title", result.title);
    add("Source SKU", result.sourceSku);
    add("Source URL", result.productLink);
    add("Platform", result.platform);
    add("Assigned person", assigned === "none" ? "Unassigned" : assigned);
    add("Finding person", findingPerson);
    add("Priority", priority);
    add("Brand / shop", result.brand);
    add("Category", result.category);
    for (const section of ["Product Details", "Price & Variations", "Materials & Specs", "Shop & Ratings"]) {
      const useful = result.extra.filter(
        (i) => i.section === section && i.value && i.value !== NOT_FOUND && i.value !== "—",
      );
      if (!useful.length) continue;
      lines.push("", section);
      useful.forEach((i) => add(i.label, i.value));
    }
    add("Notes", result.notes);
    if (result.seeds.length) {
      lines.push("", "Image URLs");
      result.seeds.forEach((u, i) => add(`Image ${i + 1}`, u));
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Copied successfully");
    } catch {
      toast.error("Copy failed. Please allow clipboard access and try again.");
    }
  };

  return (
    <SectionCard title="Add by link">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          value={link}
          placeholder="https://www.etsy.com/listing/1234567890/emerald-halo-ring"
          onChange={(e) => {
            setLink(e.target.value);
            setResult(null);
            setStatus(null);
            setAllowDuplicate(false);
          }}
          className="h-9 text-sm"
        />
        <Button size="sm" className="h-9" disabled={busy || blockedByDuplicate} onClick={() => void fetchDetails()}>
          {busy ? "Fetching…" : "Fetch Details"}
        </Button>
      </div>

      {duplicate ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-amber-100 p-2 text-[12px] text-amber-900">
          {allowDuplicate
            ? `Creating a new independent finding — ${duplicate.code} stays untouched.`
            : `This link already exists as ${duplicate.code}.`}
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onOpen(duplicate.id)}>
            Open existing finding
          </Button>
          {allowDuplicate ? null : (
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setAllowDuplicate(true)}>
              Create new independent finding
            </Button>
          )}
        </div>
      ) : null}

      {status === "failed" ? (
        <div className="mt-2 space-y-2 rounded-md bg-destructive/10 p-2 text-[12px] text-destructive">
          <p>Failed — {reason || "that link could not be read."} Nothing was saved.</p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() =>
              setResult({
                title: "",
                sku: "",
                sourceSku: "",
                platform: guessPlatform(link, platforms),
                category: categories[0] ?? "",
                brand: "",
                productLink: link.trim(),
                notes: "",
                seeds: [],
                main: "",
                extra: [],
                missing: ["title", "images"],
              })
            }
          >
            Complete manually
          </Button>
          <div className="space-y-1 rounded-md bg-card p-2 text-foreground">
            <p className="text-[12px] font-medium">Read it from the page instead</p>
            <p className="text-[11px] text-muted-foreground">
              Open the listing in your browser, select everything, and paste it here. Whatever the page
              contains will be filled in — nothing is invented.
            </p>
            <Textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={4}
              placeholder="Paste the listing text or saved page source here…"
              className="text-[12px]"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="h-7 text-[11px]"
                disabled={busy || pasted.trim().length < 40}
                onClick={() => void fetchDetails(pasted)}
              >
                {busy ? "Reading…" : "Read pasted page"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                disabled={busy}
                onClick={() => void fetchDetails()}
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {log.length ? (
        <Accordion type="single" collapsible className="mt-2 rounded-lg border border-border px-2">
          <AccordionItem value="log">
            <AccordionTrigger className="text-[13px]">
              How this was read ({log.length} step{log.length === 1 ? "" : "s"})
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1 text-[12px]">
                {log.map((l, i) => (
                  <li key={`${l.step}-${i}`} className="flex min-w-0 flex-wrap items-start gap-1">
                    <span className="font-medium text-foreground">{l.step}</span>
                    <StatusPill status={l.status.toLowerCase().replace(" ", "_")} />
                    <span className="min-w-0 break-words text-muted-foreground">{l.detail}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-3">
          {status ? (
            <p
              className={`rounded-md p-2 text-[12px] ${
                status === "complete" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
              }`}
            >
              {status === "complete"
                ? `Complete — details and ${result.seeds.length} image(s) read from the page.`
                : `Partial — could not read: ${result.missing.join(", ") || "some fields"}. Everything found is kept below; fill in the rest.`}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <SmartImage src={result.main} label={result.category} lazy={false} showFailure />
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Product title" className="sm:col-span-2">
                <Input
                  value={result.title}
                  onChange={(e) => set({ title: e.target.value })}
                  className={`h-9 text-sm ${!result.title.trim() ? "border-amber-500" : ""}`}
                />
              </Field>
              <Field label="Source SKU (seller)">
                <Input
                  value={result.sourceSku}
                  placeholder="Not found on page"
                  onChange={(e) => set({ sourceSku: e.target.value })}
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Platform">
                <Picker
                  className="w-full"
                  value={result.platform}
                  options={platforms}
                  onChange={(v) => set({ platform: v })}
                />
              </Field>
              <Field label="Assigned person">
                <Picker className="w-full" value={assigned} options={["none", ...people]} onChange={setAssigned} />
              </Field>
              <Field label="Priority">
                <Picker className="w-full" value={priority} options={FINDING_PRIORITIES} onChange={setPriority} />
              </Field>
              <p className="truncate text-[11px] text-muted-foreground sm:col-span-2">
                Source:{" "}
                <a href={result.productLink} target="_blank" rel="noreferrer" className="text-primary">
                  {result.productLink}
                </a>
              </p>
            </div>
          </div>

          <Accordion type="single" collapsible className="rounded-lg border border-border px-2">
            <AccordionItem value="details">
              <AccordionTrigger className="text-[13px]">Product Details</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Brand / shop">
                    <Input
                      value={result.brand}
                      onChange={(e) => set({ brand: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </Field>
                  <Field label="Category">
                    <Picker
                      className="w-full"
                      value={result.category}
                      options={categories}
                      onChange={(v) => set({ category: v })}
                    />
                  </Field>
                  <Field label="Finding person">
                    <Picker className="w-full" value={findingPerson} options={people} onChange={setFindingPerson} />
                  </Field>
                </div>
                <dl className="mt-2 grid gap-1 text-[12px] sm:grid-cols-2">
                  {result.extra
                    .filter((x) => x.section === "Product Details")
                    .map((x) => (
                      <div key={x.label} className="flex min-w-0 gap-1">
                        <dt className="shrink-0 text-muted-foreground">{x.label}:</dt>
                        <dd className="line-clamp-3 min-w-0">{x.value}</dd>
                      </div>
                    ))}
                </dl>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="price">
              <AccordionTrigger className="text-[13px]">Price &amp; Variations</AccordionTrigger>
              <AccordionContent>
                <dl className="grid gap-1 text-[12px] sm:grid-cols-2">
                  {result.extra
                    .filter((x) => x.section === "Price & Variations")
                    .map((x) => (
                      <div key={x.label} className="flex min-w-0 gap-1">
                        <dt className="shrink-0 text-muted-foreground">{x.label}:</dt>
                        <dd className="min-w-0 break-words">{x.value}</dd>
                      </div>
                    ))}
                </dl>
              </AccordionContent>
            </AccordionItem>
            {["Materials & Specs", "Shop & Ratings"].map((section) =>
              result.extra.some((x) => x.section === section) ? (
                <AccordionItem key={section} value={section}>
                  <AccordionTrigger className="text-[13px]">{section}</AccordionTrigger>
                  <AccordionContent>
                    <dl className="grid gap-1 text-[12px] sm:grid-cols-2">
                      {result.extra
                        .filter((x) => x.section === section)
                        .map((x) => (
                          <div key={x.label} className="flex min-w-0 gap-1">
                            <dt className="shrink-0 text-muted-foreground">{x.label}:</dt>
                            <dd className="min-w-0 break-words">{x.value}</dd>
                          </div>
                        ))}
                    </dl>
                  </AccordionContent>
                </AccordionItem>
              ) : null,
            )}

            <AccordionItem value="images">
              <AccordionTrigger className="text-[13px]">Images ({result.seeds.length})</AccordionTrigger>
              <AccordionContent>
                {result.seeds.length ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {result.seeds.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set({ main: s })}
                        className={`overflow-hidden rounded-lg ${result.main === s ? "ring-2 ring-ring" : ""}`}
                        aria-label="Use this image as the main image"
                      >
                        <SmartImage src={s} label="Product listing image" showFailure />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground">No images could be read from this page.</p>
                )}
                <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    value={manualImage}
                    placeholder="Paste an image address to add it manually"
                    onChange={(e) => setManualImage(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={() => {
                      const u = manualImage.trim();
                      if (!/^https?:\/\//i.test(u)) {
                        toast.error("Paste a full image address starting with http.");
                        return;
                      }
                      set({ seeds: [...result.seeds, u], main: result.main || u });
                      setManualImage("");
                    }}
                  >
                    Add image
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="notes">
              <AccordionTrigger className="text-[13px]">Notes &amp; Additional Information</AccordionTrigger>
              <AccordionContent>
                <Textarea
                  rows={3}
                  value={result.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  className="text-sm"
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="h-9" onClick={() => void copyAll()}>
              <Copy className="size-4" /> Copy All
            </Button>
            <Button
              size="sm"
              className="h-9"
              onClick={() => {
                if (!result.title.trim()) return toast.error("Add a product title before saving.");
                void onSave({
                  title: result.title,
                  product_url: result.productLink,
                  platform: result.platform,
                  category: result.category,
                  brand: result.brand,
                  priority,
                  note: result.notes,
                  finding_by: findingPerson,
                  assigned_to: assigned === "none" ? null : assigned,
                  status: assigned === "none" ? "unassigned" : "assigned",
                  source_sku: result.sourceSku,
                  image_seeds: result.seeds,
                  main_image: result.main || null,
                  extra: result.extra,
                });
              }}
            >
              Save Finding
            </Button>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

/* ---------------- manual add ---------------- */

function ManualForm({
  people,
  platforms,
  categories,
  me,
  existingLinks,
  onSave,
  onCancel,
}: {
  people: string[];
  platforms: string[];
  categories: string[];
  me: string;
  existingLinks: string[];
  onSave: (input: FindingInput) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    product_url: "",
    platform: platforms[0] ?? "Other",
    category: categories[0] ?? "",
    brand: "",
    priority: "medium",
    note: "",
    finding_by: people[0] ?? me,
    assigned_to: "none",
    main_image: "",
  });
  const [images, setImages] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState({ uploading: 0, failed: 0 });
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  return (
    <SectionCard title="Manual Add">
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim()) return toast.error("Add a title for this finding.");
          if (form.product_url.trim() && existingLinks.includes(form.product_url.trim()))
            return toast.error("A finding with this product link already exists.");
          if (uploadStatus.uploading > 0) return toast.error("Some images are still saving.");
          if (uploadStatus.failed > 0) return toast.error("Some images failed to save.");
          void onSave({
            title: form.title,
            product_url: form.product_url || null,
            platform: form.platform,
            category: form.category,
            brand: form.brand,
            priority: form.priority,
            note: form.note,
            finding_by: form.finding_by,
            assigned_to: form.assigned_to === "none" ? null : form.assigned_to,
            status: form.assigned_to === "none" ? "unassigned" : "assigned",
            image_seeds: images,
            main_image: form.main_image || images[0] || null,
          });
        }}
      >
        <Field label="Title" className="sm:col-span-2">
          <Input value={form.title} onChange={(e) => set({ title: e.target.value })} className="h-9 text-sm" />
        </Field>
        <Field label="Product link">
          <Input
            value={form.product_url}
            onChange={(e) => set({ product_url: e.target.value })}
            placeholder="https://example.com/listing/…"
            className="h-9 text-sm"
          />
        </Field>
        <Field label="Platform / source">
          <Picker className="w-full" value={form.platform} options={platforms} onChange={(v) => set({ platform: v })} />
        </Field>
        <Field label="Category">
          <Picker className="w-full" value={form.category} options={categories} onChange={(v) => set({ category: v })} />
        </Field>
        <Field label="Brand / shop">
          <Input value={form.brand} onChange={(e) => set({ brand: e.target.value })} className="h-9 text-sm" />
        </Field>
        <Field label="Priority">
          <Picker
            className="w-full"
            value={form.priority}
            options={FINDING_PRIORITIES}
            onChange={(v) => set({ priority: v })}
          />
        </Field>
        <Field label="Finding person">
          <Picker className="w-full" value={form.finding_by} options={people} onChange={(v) => set({ finding_by: v })} />
        </Field>
        <Field label="Assigned person">
          <Picker
            className="w-full"
            value={form.assigned_to}
            options={["none", ...people]}
            onChange={(v) => set({ assigned_to: v })}
          />
        </Field>
        <Field
          label="Add images"
          hint="Reference images only — product photos and QC stay separate."
          className="sm:col-span-2 lg:col-span-3"
        >
          <ImageUploadArea
            images={images}
            main={form.main_image}
            onChange={(next, main) => {
              setImages(next);
              set({ main_image: main });
            }}
            onStatusChange={setUploadStatus}
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
          <Textarea rows={3} value={form.note} onChange={(e) => set({ note: e.target.value })} className="text-sm" />
        </Field>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="submit" size="sm" className="h-9">
            Save Finding
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-9" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
