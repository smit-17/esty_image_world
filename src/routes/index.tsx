import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { bootstrapSuperAdmin } from "@/lib/superadmin.functions";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — LEPDO Lifestyle Jewelry Image Manager" },
      {
        name: "description",
        content:
          "Sign in to the LEPDO Lifestyle workspace to manage jewelry products, images and estimates.",
      },
      { property: "og:title", content: "Sign in — LEPDO Lifestyle" },
      {
        property: "og:description",
        content: "Secure account access to the LEPDO Lifestyle AI jewelry image library.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { ready, isAuthenticated, isActive, status, signIn, homePath } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    if (isActive) navigate({ to: homePath, replace: true });
    else navigate({ to: "/pending", replace: true });
  }, [ready, isAuthenticated, isActive, status, homePath, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let res = await signIn(email, password);
    if (res.error) {
      // Super Admin fallback: provision/repair the account from the env password.
      const boot = await bootstrapSuperAdmin({ data: { email, password } });
      if (boot.ok) res = await signIn(email, password);
    }
    setBusy(false);
    if (res.error) setError(res.error);
  }


  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-16">
      <div className="pointer-events-none absolute -left-40 -top-40 size-[28rem] rounded-full bg-ivory/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 -right-40 size-[32rem] rounded-full bg-secondary blur-3xl" />

      <div className="relative w-full max-w-[26rem]">
        <div className="flex flex-col items-center text-center">
          <Logo className="size-20 shadow-lift" />
          <h1 className="mt-7 text-4xl font-medium text-primary">Lepdo Lifestyle</h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Sparkles className="size-3.5 text-gold" strokeWidth={2} />
            AI Jewelry Image Manager
          </p>
        </div>

        <form onSubmit={onSubmit} className="surface mt-9 space-y-4 p-7">
          <div className="space-y-2">
            <label htmlFor="email" className="text-eyebrow">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-eyebrow">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          {error && <p className="text-center text-xs text-destructive">{error}</p>}

          <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-base">
            {busy && <Loader2 className="size-4 animate-spin" />} Sign in
          </Button>

          <div className="flex items-center justify-between pt-1 text-xs">
            <Link to="/forgot-password" className="text-muted-foreground hover:text-primary">
              Forgot password?
            </Link>
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create account
            </Link>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          New accounts need Super Admin approval before access is granted.
        </p>
      </div>
    </div>
  );
}
