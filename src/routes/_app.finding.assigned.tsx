import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageLightbox } from "@/components/ImageLightbox";
import { FindingGate } from "@/components/finding/FindingGate";
import { FindingLayout } from "@/components/finding/FindingLayout";
import { FindingThumb, useSignedUrl } from "@/components/finding/FindingThumb";
import {
  FINDING_CATEGORIES,
  FINDING_PLATFORMS,
  FINDING_PRIORITIES,
  FINDING_STATUSES,
  fetchFindingMembers,
  fetchFindingOptions,
  fetchFindings,
  formatDateTime,
  optionValues,
  updateFinding,
  type Finding,
} from "@/lib/findings";

export const Route = createFileRoute("/_app/finding/assigned")({
  head: () => ({
    meta: [
      { title: "Assigned Findings — LEPDO Lifestyle" },
      { name: "description", content: "See each team member's assigned findings and update status instantly." },
      { property: "og:title", content: "Assigned Findings — LEPDO Lifestyle" },
      { property: "og:description", content: "Track each team member's assigned jewelry findings." },
    ],
  }),
  component: () => (
    <FindingGate>
      <AssignedPage />
    </FindingGate>
  ),
});

const PAGE_SIZE = 25;
const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring";

function Preview({ path, onClose }: { path: string; onClose: () => void }) {
  const url = useSignedUrl(path);
  if (!url) return null;
  return <ImageLightbox urls={[url]} index={0} onIndexChange={() => {}} onClose={onClose} />;
}

function AssignedPage() {
  const queryClient = useQueryClient();
  const { data: findings = [] } = useQuery({ queryKey: ["findings"], queryFn: fetchFindings });
  const { data: members = [] } = useQuery({ queryKey: ["finding-members"], queryFn: fetchFindingMembers });
  const { data: options = [] } = useQuery({ queryKey: ["finding-options"], queryFn: fetchFindingOptions });

  const [person, setPerson] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const [findingBy, setFindingBy] = useState("");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [preview, setPreview] = useState<string | null>(null);

  const categories = optionValues(options, "category", FINDING_CATEGORIES);
  const platforms = optionValues(options, "platform", FINDING_PLATFORMS);

  const assigned = useMemo(() => findings.filter((f) => !!f.assigned_to), [findings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assigned.filter((f) => {
      if (person && f.assigned_to !== person) return false;
      if (status && f.status !== status) return false;
      if (priority && f.priority !== priority) return false;
      if (platform && f.platform !== platform) return false;
      if (category && f.category !== category) return false;
      if (findingBy && f.finding_by !== findingBy) return false;
      if (!q) return true;
      return [f.code, f.brand, f.category, f.style, f.note, f.product_url]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [assigned, person, status, priority, platform, category, findingBy, search]);

  const rows = filtered.slice(0, visible);

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

  return (
    <FindingLayout title="Assigned">
      <div className="rounded-xl border border-border/70 bg-card p-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-7">
          <select
            className={selectClass}
            value={person}
            onChange={(e) => {
              setPerson(e.target.value);
              setVisible(PAGE_SIZE);
            }}
          >
            <option value="">All members ({assigned.length})</option>
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
          <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">All priorities</option>
            {FINDING_PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
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
          <select className={selectClass} value={findingBy} onChange={(e) => setFindingBy(e.target.value)}>
            <option value="">All finders</option>
            {members.map((m) => (
              <option key={m.id}>{m.name}</option>
            ))}
          </select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="col-span-2 h-9 rounded-lg text-xs lg:col-span-1"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {rows.length} of {filtered.length}
        </p>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="w-full min-w-[1200px] text-xs">
          <thead className="bg-secondary/60 text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">ID</th>
              <th className="p-2">Image</th>
              <th className="p-2">Product</th>
              <th className="p-2">Platform</th>
              <th className="p-2">Brand</th>
              <th className="p-2">Category</th>
              <th className="p-2">Gender</th>
              <th className="p-2">Style</th>
              <th className="p-2">Priority</th>
              <th className="p-2">Notes</th>
              <th className="p-2">Finding by</th>
              <th className="p-2">Assigned</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} className="border-t border-border/70 align-top">
                <td className="p-2 font-medium">{f.code}</td>
                <td className="p-2">
                  <FindingThumb
                    path={f.thumb_path ?? f.image_path}
                    size={36}
                    onClick={() => f.image_path && setPreview(f.image_path)}
                  />
                </td>
                <td className="p-2">
                  {f.product_url ? (
                    <a
                      href={f.product_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 whitespace-nowrap text-primary hover:underline"
                    >
                      Open Product <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-2">{f.platform}</td>
                <td className="p-2">{f.brand ?? "—"}</td>
                <td className="p-2">{f.category ?? "—"}</td>
                <td className="p-2">{f.gender ?? "—"}</td>
                <td className="p-2">{f.style ?? "—"}</td>
                <td className="p-2">{f.priority}</td>
                <td className="max-w-[220px] p-2 text-muted-foreground">{f.note || "—"}</td>
                <td className="p-2">{f.finding_by ?? "—"}</td>
                <td className="p-2 whitespace-nowrap text-muted-foreground">{formatDateTime(f.updated_at)}</td>
                <td className="p-2">
                  <select
                    className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                    value={f.status || "Pending"}
                    onChange={(e) => void setRowStatus(f, e.target.value)}
                  >
                    {FINDING_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="p-5 text-center text-muted-foreground">
                  Nothing assigned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {visible < filtered.length && (
        <div className="flex justify-center">
          <Button variant="outline" className="rounded-full px-5" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Load more ({filtered.length - visible} left)
          </Button>
        </div>
      )}

      {preview && <Preview path={preview} onClose={() => setPreview(null)} />}
    </FindingLayout>
  );
}
