import { supabase } from "@/integrations/supabase/client";
import { currentActor } from "@/lib/auth";
import { BUCKET } from "@/lib/lepdo";

export const FINDING_PLATFORMS = ["Etsy", "Pinterest", "Google", "Brand Website", "Other"];
export const FINDING_CATEGORIES = ["Ring", "Earring", "Necklace", "Bracelet"];
export const FINDING_STYLES = ["Classic", "Regular", "Unique Cut Diamond", "Gemstone Jewelry"];
export const FINDING_GENDERS = ["Male", "Female", "Unisex"];
export const FINDING_PRIORITIES = ["low", "medium", "high"];
export const FINDING_STATUSES = ["unassigned", "assigned", "in_progress", "moved"];

export type FindingExtra = { section: string; label: string; value: string };

export type Finding = {
  id: string;
  code: string;
  title: string | null;
  source_sku: string | null;
  product_url: string | null;
  platform: string;
  brand: string | null;
  category: string | null;
  gender: string | null;
  style: string | null;
  priority: string;
  note: string | null;
  finding_by: string | null;
  image_path: string | null;
  thumb_path: string | null;
  main_image: string | null;
  image_seeds: string[] | null;
  extra: FindingExtra[] | null;
  assigned_to: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

/** Old rows used "High" / "Pending" — normalise to the keys the UI works with. */
export function normalizePriority(value?: string | null) {
  const v = (value ?? "").toLowerCase();
  return FINDING_PRIORITIES.includes(v) ? v : "medium";
}

export function normalizeStatus(finding: { status?: string | null; assigned_to?: string | null }) {
  const v = (finding.status ?? "").toLowerCase().replace(/\s+/g, "_");
  if (FINDING_STATUSES.includes(v)) return v;
  if (v === "done") return "moved";
  return finding.assigned_to ? "assigned" : "unassigned";
}

export function findingImages(f: Finding): string[] {
  const seeds = Array.isArray(f.image_seeds) ? f.image_seeds : [];
  return Array.from(new Set([f.main_image, f.image_path, ...seeds].filter(Boolean) as string[]));
}

export function mainImageOf(f: Finding): string | null {
  return findingImages(f)[0] ?? null;
}

export type FindingMember = { id: string; name: string; email: string | null; created_at: string };
export type FindingOption = { id: string; kind: string; value: string; created_at: string };
export type FindingActivity = {
  id: string;
  finding_id: string | null;
  finding_code: string | null;
  user_name: string | null;
  activity: string;
  created_at: string;
};

/* ---------------- current finding user (simple login) ---------------- */

const USER_KEY = "lepdo.finding.user";
export type FindingUser = { name: string; email: string };

export function getFindingUser(): FindingUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FindingUser;
    return parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

export function setFindingUser(user: FindingUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearFindingUser() {
  localStorage.removeItem(USER_KEY);
}

/* ---------------- queries ---------------- */

export async function fetchFindings(): Promise<Finding[]> {
  const { data, error } = await supabase
    .from("findings" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as unknown as Finding[];
}

export async function fetchFindingMembers(): Promise<FindingMember[]> {
  const { data, error } = await supabase
    .from("finding_team_members" as never)
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as FindingMember[];
}

export async function fetchFindingOptions(): Promise<FindingOption[]> {
  const { data, error } = await supabase
    .from("finding_options" as never)
    .select("*")
    .order("value");
  if (error) throw error;
  return (data ?? []) as unknown as FindingOption[];
}

export function optionValues(options: FindingOption[], kind: string, fallback: string[]) {
  const values = options.filter((o) => o.kind === kind).map((o) => o.value);
  return values.length ? values : fallback;
}

export async function fetchFindingActivity(limit = 200): Promise<FindingActivity[]> {
  const { data, error } = await supabase
    .from("finding_activity" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FindingActivity[];
}

export async function logActivity(
  activity: string,
  finding?: { id?: string | null; code?: string | null },
) {
  const user = getFindingUser() ?? { name: currentActor().name ?? "Unknown" };
  await supabase.from("finding_activity" as never).insert({
    finding_id: finding?.id ?? null,
    finding_code: finding?.code ?? null,
    user_name: user?.name ?? "Unknown",
    activity,
  } as never);
}

/* ---------------- mutations ---------------- */

export async function nextFindingCode(): Promise<string> {
  const { data } = await supabase
    .from("findings" as never)
    .select("code")
    .order("created_at", { ascending: false })
    .limit(50);
  let max = 0;
  for (const row of (data ?? []) as unknown as { code: string }[]) {
    const n = Number(String(row.code).replace(/\D/g, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `FND-${String(max + 1).padStart(5, "0")}`;
}

export type FindingInput = Partial<Omit<Finding, "id" | "created_at" | "updated_at">>;

export async function createFinding(input: FindingInput): Promise<Finding> {
  const { data, error } = await supabase
    .from("findings" as never)
    .insert(input as never)
    .select("*")
    .single();
  if (error) throw error;
  const row = data as unknown as Finding;
  await logActivity("Finding created", row);
  return row;
}

export async function updateFinding(
  finding: Pick<Finding, "id" | "code">,
  patch: FindingInput,
  activity = "Finding edited",
) {
  const { error } = await supabase
    .from("findings" as never)
    .update(patch as never)
    .eq("id", finding.id);
  if (error) throw error;
  await logActivity(activity, finding);
}

export async function assignFindings(ids: string[], assignee: string, codes: string[] = []) {
  const { error } = await supabase
    .from("findings" as never)
    .update({ assigned_to: assignee, status: "Pending" } as never)
    .in("id", ids);
  if (error) throw error;
  const user = getFindingUser();
  await supabase.from("finding_activity" as never).insert(
    ids.map((id, i) => ({
      finding_id: id,
      finding_code: codes[i] ?? null,
      user_name: user?.name ?? "Unknown",
      activity: `Assigned to ${assignee}`,
    })) as never,
  );
}

export async function deleteFinding(finding: Pick<Finding, "id" | "code" | "image_path" | "thumb_path">) {
  const paths = [finding.image_path, finding.thumb_path].filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from("findings" as never).delete().eq("id", finding.id);
  if (error) throw error;
  await logActivity("Finding deleted", finding);
}

/* ---------------- image upload ---------------- */

async function toWebp(file: File, maxDim: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed"))), "image/webp", quality),
  );
}

export async function uploadFindingImage(file: File): Promise<{ path: string; thumbPath: string }> {
  const [full, thumb] = await Promise.all([toWebp(file, 1600, 0.85), toWebp(file, 320, 0.7)]);
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`;
  const path = `findings/${key}`;
  const thumbPath = `findings/thumbs/${key}`;
  const [a, b] = await Promise.all([
    supabase.storage.from(BUCKET).upload(path, full, { contentType: "image/webp", cacheControl: "31536000" }),
    supabase.storage.from(BUCKET).upload(thumbPath, thumb, { contentType: "image/webp", cacheControl: "31536000" }),
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  return { path, thumbPath };
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
