import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — LEPDO Lifestyle" },
      { name: "description", content: "Choose a new password for your LEPDO Lifestyle workspace account." },
      { property: "og:title", content: "Set a new password — LEPDO Lifestyle" },
      { property: "og:description", content: "Choose a new password for LEPDO Lifestyle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { updatePassword, homePath } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) setError(res.error);
    else navigate({ to: homePath, replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo className="size-16 shadow-lift" />
          <h1 className="mt-5 text-2xl font-medium text-primary">Set a new password</h1>
        </div>
        <form onSubmit={onSubmit} className="surface mt-7 space-y-4 p-7">
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-eyebrow">
              New password
            </label>
            <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-eyebrow">
              Confirm password
            </label>
            <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 rounded-xl" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">
            {busy && <Loader2 className="size-4 animate-spin" />} Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
