import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FindingGate } from "@/components/finding/FindingGate";
import { FindingLayout } from "@/components/finding/FindingLayout";
import { FindingThumb } from "@/components/finding/FindingThumb";
import {
  FINDING_CATEGORIES,
  FINDING_PLATFORMS,
  FINDING_PRIORITIES,
  FINDING_STATUSES,
  FINDING_STYLES,
  assignFindings,
  deleteFinding,
  fetchFindingMembers,
  fetchFindingOptions,
  fetchFindings,
  formatDateTime,
  optionValues,
  updateFinding,
  type Finding,
} from "@/lib/findings";

export const Route = createFileRoute("/_app/finding/all")({
  head: () => ({
    meta: [
      { title: "All Findings — LEPDO Lifestyle" },
      { name: "description", content: "Search, filter and assign every saved jewelry finding." },
      { property: "og:title", content: "All Findings — LEPDO Lifestyle" },
      { property: "og:description", content: "Search, filter and assign saved jewelry findings." },
    ],
  }),
  component: () => (
    <FindingGate>
      <AllFindingsPage />
    </FindingGate>
  ),
});

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const PAGE_SIZE = 20;

function AllFindingsPage() {
  const queryClient = useQueryClient();
  const { data: findings = [] } = useQuery({ queryKey: ["findings"], queryFn: fetchFindings });
  const { data: members = [] } = useQuery({ queryKey: ["finding-members"], queryFn: fetchFindingMembers });
  const { data: options = [] } = useQuery({ queryKey: ["finding-options"], queryFn: fetchFindingOptions });

  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [findingBy, setFindingBy] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [assignee, setAssignee] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const categories = optionValues(options, "category", FINDING_CATEGORIES);
  const platforms = optionValues(options, "platform", FINDING_PLATFORMS);
  void optionValues(options, "style", FINDING_STYLES);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return findings.filter((f) => {
      if (platform && f.platform !== platform) return false;
      if (category && f.category !== category) return false;
      if (priority && f.priority !== priority) return false;
      if (findingBy && f.finding_by !== findingBy) return false;
      if (assignedTo && (f.assigned_to ?? "") !== assignedTo) return false;
      if (status && f.status !== status) return false;
      if (!q) return true;
      return [f.code, f.brand, f.category, f.style, f.note, f.product_url]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [findings, search, platform, category, priority, findingBy, assignedTo, status]);

  const rows = filtered.slice(0, visible);
  const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function assign() {
    if (!assignee) return toast.error("Select a team member");
    if (!selected.length) return toast.error("Select at least one finding");
    try {
      const codes = selected.map((id) => findings.find((f) => f.id === id)?.code ?? "");
      await assignFindings(selected, assignee, codes);
      await queryClient.invalidateQueries({ queryKey: ["findings"] });
      setSelected([]);
      toast.success(`Assigned to ${assignee}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function setRowStatus(f: Finding, value: string) {
    const previous = f.status;
    // Instant inline update; the write happens in the background.
    const patch = (v: string) => (rows?: Finding[]) =>
      rows?.map((r) => (r.id === f.id ? { ...r, status: v } : r));
    queryClient.setQueryData(["findings"], patch(value));
    try {
      await updateFinding(f, { status: value }, `Status changed to ${value}`);
    } catch (err) {
      queryClient.setQueryData(["findings"], patch(previous));
      toast.error((err as Error).message);
    }
  }

  async function remove(f: Finding) {
    try {
      await deleteFinding(f);
      await queryClient.invalidateQueries({ queryKey: ["findings"] });
      toast.success("Finding deleted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <FindingLayout title="All Findings">

      <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ID, brand, note…"
          className="h-10 rounded-xl"
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <select className={selectClass} value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">All platforms</option>
            {platforms.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">All priorities</option>
            {FINDING_PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select className={selectClass} value={findingBy} onChange={(e) => setFindingBy(e.target.value)}>
            <option value="">All finders</option>
            {members.map((m) => (
              <option key={m.id}>{m.name}</option>
            ))}
          </select>
          <select className={selectClass} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">All assignees</option>
            {members.map((m) => (
              <option key={m.id}>{m.name}</option>
            ))}
          </select>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {FINDING_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">{selected.length} selected</span>
          <select
            className={`${selectClass} max-w-56`}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">Assign to…</option>
            {members.map((m) => (
              <option key={m.id}>{m.name}</option>
            ))}
          </select>
          <Button className="h-10 rounded-xl px-5" onClick={() => void assign()}>
            Assign
          </Button>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="w-full min-w-[1100px] text-xs">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => setSelected(allChecked ? [] : rows.map((r) => r.id))}
                />
              </th>
              <th className="p-2">ID</th>
              <th className="p-2">Image</th>
              <th className="p-2">Platform</th>
              <th className="p-2">Brand</th>
              <th className="p-2">Category</th>
              <th className="p-2">Style</th>
              <th className="p-2">Priority</th>
              <th className="p-2">Finding by</th>
              <th className="p-2">Assigned to</th>
              <th className="p-2">Status</th>
              <th className="p-2">Date</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} className="border-t border-border/70">
                <td className="p-2">
                  <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggle(f.id)} />
                </td>
                <td className="p-3 font-medium">{f.code}</td>
                <td className="p-2">
                  <FindingThumb path={f.thumb_path ?? f.image_path} />
                </td>
                <td className="p-2">{f.platform}</td>
                <td className="p-2">{f.brand ?? "—"}</td>
                <td className="p-2">{f.category ?? "—"}</td>
                <td className="p-2">{f.style ?? "—"}</td>
                <td className="p-2">{f.priority}</td>
                <td className="p-2">{f.finding_by ?? "—"}</td>
                <td className="p-2">{f.assigned_to ?? "—"}</td>
                <td className="p-2">
                  <select
                    className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
                    value={f.status}
                    onChange={(e) => void setRowStatus(f, e.target.value)}
                  >
                    {FINDING_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDateTime(f.created_at)}</td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    {f.product_url && (
                      <a
                        href={f.product_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg p-2 text-muted-foreground hover:text-primary"
                        aria-label="Open product link"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                    <button
                      onClick={() => void remove(f)}
                      className="rounded-lg p-2 text-destructive"
                      aria-label={`Delete ${f.code}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="p-6 text-center text-muted-foreground">
                  No findings match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {visible < filtered.length && (
        <div className="flex justify-center">
          <Button variant="outline" className="rounded-full px-6" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Load more ({filtered.length - visible} left)
          </Button>
        </div>
      )}
    </FindingLayout>
  );
}
