import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "My profile — LEPDO Lifestyle" },
      { name: "description", content: "Manage your LEPDO Lifestyle account details and password." },
      { property: "og:title", content: "My profile — LEPDO Lifestyle" },
      { property: "og:description", content: "Manage your LEPDO Lifestyle account details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, roles, status, updateProfile, updatePassword } = useAuth();
  const [form, setForm] = useState({ full_name: "", username: "", mobile: "", bio: "" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      username: profile.username ?? "",
      mobile: profile.mobile ?? "",
      bio: profile.bio ?? "",
    });
  }, [profile]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await updateProfile(form);
    setBusy(false);
    if (res.error) toast.error(res.error);
    else toast.success("Profile updated");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw.next !== pw.confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const res = await updatePassword(pw.next, pw.current);
    setBusy(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Password changed");
      setPw({ current: "", next: "", confirm: "" });
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-2">
      <section className="surface space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Account details</h2>
          {status && <Badge variant="secondary">{STATUS_LABEL[status]}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {profile?.email} · {roles.map((r) => r.name).join(", ") || "No role assigned"}
        </p>
        <form onSubmit={saveProfile} className="space-y-3">
          <Input
            placeholder="Full name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <Input
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <Input
            placeholder="Mobile"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
          <Textarea
            placeholder="Short bio"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
          <Button type="submit" disabled={busy} className="rounded-full">
            Save changes
          </Button>
        </form>
      </section>

      <section className="surface space-y-4 p-6">
        <h2 className="text-lg font-medium">Change password</h2>
        <form onSubmit={savePassword} className="space-y-3">
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          />
          <Button type="submit" disabled={busy} className="rounded-full">
            Update password
          </Button>
        </form>
      </section>
    </div>
  );
}
