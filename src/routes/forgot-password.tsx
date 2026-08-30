import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — LEPDO Lifestyle" },
      { name: "description", content: "Request a password reset link for your LEPDO Lifestyle workspace account." },
      { property: "og:title", content: "Reset your password — LEPDO Lifestyle" },
      { property: "og:description", content: "Request a password reset link for LEPDO Lifestyle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await forgotPassword(email);
    setBusy(false);
    if (res.error) setError(res.error);
    else setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo className="size-16 shadow-lift" />
          <h1 className="mt-5 text-2xl font-medium text-primary">Forgot password</h1>
        </div>

        {sent ? (
          <div className="surface mt-7 space-y-3 p-7 text-center">
            <MailCheck className="mx-auto size-8 text-primary" strokeWidth={1.6} />
            <p className="text-sm text-muted-foreground">
              If an account exists for {email}, a reset link is on its way.
            </p>
            <Link to="/" className="inline-block text-sm font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="surface mt-7 space-y-4 p-7">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-eyebrow">
                Account email
              </label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">
              {busy && <Loader2 className="size-4 animate-spin" />} Send reset link
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <Link to="/" className="hover:text-primary">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
