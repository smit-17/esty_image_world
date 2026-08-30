import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — LEPDO Lifestyle" },
      {
        name: "description",
        content:
          "Request a LEPDO Lifestyle workspace account. Registrations are reviewed and approved by a Super Admin.",
      },
      { property: "og:title", content: "Create account — LEPDO Lifestyle" },
      {
        property: "og:description",
        content: "Request access to the LEPDO Lifestyle jewelry workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { ready, isAuthenticated, isActive, signUp, homePath } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    mobile: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    navigate({ to: isActive ? homePath : "/pending", replace: true });
  }, [ready, isAuthenticated, isActive, homePath, navigate]);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setBusy(true);
    const res = await signUp({
      email: form.email,
      password: form.password,
      fullName: form.fullName,
      username: form.username.trim().toLowerCase(),
      mobile: form.mobile,
    });
    setBusy(false);
    if (res.error) setError(res.error);
    else navigate({ to: "/pending", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo className="size-16 shadow-lift" />
          <h1 className="mt-5 text-3xl font-medium text-primary">Create your account</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            A Super Admin will review and approve your request.
          </p>
        </div>

        <form onSubmit={onSubmit} className="surface mt-7 space-y-4 p-7">
          <Field label="Full name" id="fullName">
            <Input id="fullName" required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className="h-11 rounded-xl" />
          </Field>
          <Field label="Username" id="username">
            <Input id="username" required value={form.username} onChange={(e) => set("username", e.target.value)} className="h-11 rounded-xl" />
          </Field>
          <Field label="Email" id="email">
            <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="h-11 rounded-xl" />
          </Field>
          <Field label="Mobile (optional)" id="mobile">
            <Input id="mobile" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} className="h-11 rounded-xl" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" id="password">
              <Input id="password" type="password" required autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} className="h-11 rounded-xl" />
            </Field>
            <Field label="Confirm" id="confirm">
              <Input id="confirm" type="password" required autoComplete="new-password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} className="h-11 rounded-xl" />
            </Field>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">
            {busy && <Loader2 className="size-4 animate-spin" />} Submit registration
          </Button>

          <p className="pt-1 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-eyebrow">
        {label}
      </label>
      {children}
    </div>
  );
}
