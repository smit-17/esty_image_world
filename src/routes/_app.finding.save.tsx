import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FindingGate } from "@/components/finding/FindingGate";
import { FindingLayout } from "@/components/finding/FindingLayout";
import {
  FINDING_CATEGORIES,
  FINDING_GENDERS,
  FINDING_PLATFORMS,
  FINDING_PRIORITIES,
  FINDING_STYLES,
  createFinding,
  fetchFindingMembers,
  fetchFindingOptions,
  logActivity,
  nextFindingCode,
  optionValues,
  uploadFindingImage,
} from "@/lib/findings";

export const Route = createFileRoute("/_app/finding/save")({
  head: () => ({
    meta: [
      { title: "Save Finding — LEPDO Lifestyle" },
      { name: "description", content: "Save a new jewelry finding with platform, style and priority." },
      { property: "og:title", content: "Save Finding — LEPDO Lifestyle" },
      { property: "og:description", content: "Save a new jewelry finding in seconds." },
    ],
  }),
  component: () => (
    <FindingGate>
      <SaveFindingPage />
    </FindingGate>
  ),
});

const selectClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const EMPTY = {
  product_url: "",
  platform: "Etsy",
  brand: "",
  category: "Ring",
  gender: "Female",
  style: "Classic",
  priority: "Medium",
  note: "",
  finding_by: "",
};

function SaveFindingPage() {
  const queryClient = useQueryClient();
  const { data: members = [] } = useQuery({ queryKey: ["finding-members"], queryFn: fetchFindingMembers });
  const { data: options = [] } = useQuery({ queryKey: ["finding-options"], queryFn: fetchFindingOptions });

  const [code, setCode] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const categories = optionValues(options, "category", FINDING_CATEGORIES);
  const platforms = optionValues(options, "platform", FINDING_PLATFORMS);
  const styles = optionValues(options, "style", FINDING_STYLES);

  useEffect(() => {
    nextFindingCode().then(setCode);
  }, []);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(addNew: boolean) {
    if (!code.trim()) return toast.error("Finding ID is required");
    setSaving(true);
    try {
      let image_path: string | null = null;
      let thumb_path: string | null = null;
      if (file) {
        const up = await uploadFindingImage(file);
        image_path = up.path;
        thumb_path = up.thumbPath;
      }
      const row = await createFinding({
        code: code.trim(),
        product_url: form.product_url.trim() || null,
        platform: form.platform,
        brand: form.brand.trim() || null,
        category: form.category,
        gender: form.gender,
        style: form.style,
        priority: form.priority,
        note: form.note.trim() || null,
        finding_by: form.finding_by || null,
        image_path,
        thumb_path,
        status: "Pending",
      });
      if (image_path) await logActivity("Image uploaded", row);
      await queryClient.invalidateQueries({ queryKey: ["findings"] });
      toast.success(`${row.code} saved`);
      setFile(null);
      setCode(await nextFindingCode());
      if (addNew) setForm((f) => ({ ...EMPTY, platform: f.platform, finding_by: f.finding_by }));
      else setForm(EMPTY);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FindingLayout title="Finding Save">

      <form
        className="surface max-w-3xl space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Finding ID">
            <Input value={code} onChange={(e) => setCode(e.target.value)} className="h-11 rounded-xl" />
          </Field>
          <Field label="Product URL">
            <Input
              value={form.product_url}
              onChange={(e) => set("product_url", e.target.value)}
              placeholder="https://…"
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Platform">
            <select className={selectClass} value={form.platform} onChange={(e) => set("platform", e.target.value)}>
              {platforms.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Brand / Shop name">
            <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} className="h-11 rounded-xl" />
          </Field>
          <Field label="Category">
            <select className={selectClass} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Gender">
            <select className={selectClass} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              {FINDING_GENDERS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="Style">
            <select className={selectClass} value={form.style} onChange={(e) => set("style", e.target.value)}>
              {styles.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className={selectClass} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              {FINDING_PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Finding by">
            <select
              className={selectClass}
              value={form.finding_by}
              onChange={(e) => set("finding_by", e.target.value)}
            >
              <option value="">Select…</option>
              {members.map((m) => (
                <option key={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Reference image">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:text-primary"
            />
          </Field>
        </div>

        <Field label="Note">
          <Textarea
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            rows={3}
            maxLength={1000}
            className="rounded-xl"
          />
        </Field>

        <div className="flex flex-wrap gap-3 pt-1">
          <Button type="submit" disabled={saving} className="h-11 rounded-xl px-6">
            Save Finding
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => void save(true)}
            className="h-11 rounded-xl px-6"
          >
            Save &amp; Add New
          </Button>
        </div>
      </form>
    </FindingLayout>
  );
}
