import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGate } from "@/lib/gate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — LEPDO Lifestyle Jewelry Image Manager" },
      {
        name: "description",
        content:
          "Secure access to the LEPDO Lifestyle library of AI-generated jewelry imagery.",
      },
      { property: "og:title", content: "Sign in — LEPDO Lifestyle" },
      {
        property: "og:description",
        content: "Secure access to the LEPDO Lifestyle AI jewelry image library.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { ready, unlocked, unlock } = useGate();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (ready && unlocked) navigate({ to: "/dashboard", replace: true });
  }, [ready, unlocked, navigate]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (unlock(password)) {
      navigate({ to: "/dashboard", replace: true });
    } else {
      setError(true);
    }
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

        <form onSubmit={onSubmit} className="surface mt-9 space-y-5 p-7">
          <div className="space-y-2">
            <label htmlFor="password" className="text-eyebrow">
              Access password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              className="h-12 rounded-xl text-center text-lg tracking-[0.3em]"
            />
            {error && (
              <p className="text-center text-xs text-destructive">
                That password doesn't match. Please try again.
              </p>
            )}
          </div>

          <Button type="submit" className="h-12 w-full rounded-xl text-base">
            Enter workspace
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Shared team access · Demo password 901902
        </p>
      </div>
    </div>
  );
}
