import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Clock, ShieldAlert } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/pending")({
  head: () => ({
    meta: [
      { title: "Account pending approval — LEPDO Lifestyle" },
      { name: "description", content: "Your LEPDO Lifestyle account is awaiting Super Admin approval." },
      { property: "og:title", content: "Account pending approval — LEPDO Lifestyle" },
      { property: "og:description", content: "Your LEPDO Lifestyle account is awaiting approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PendingPage,
});

const MESSAGE: Record<string, string> = {
  PENDING_APPROVAL: "Your registration has been received and is waiting for a Super Admin to approve it.",
  REJECTED: "Your registration was rejected. Please contact your administrator.",
  BLOCKED: "This account has been blocked. Please contact your administrator.",
  SUSPENDED: "This account is suspended. Please contact your administrator.",
  INACTIVE: "This account is inactive. Please contact your administrator.",
};

function PendingPage() {
  const { ready, isAuthenticated, isActive, status, profile, signOut, homePath, refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) navigate({ to: "/", replace: true });
    else if (isActive) navigate({ to: homePath, replace: true });
  }, [ready, isAuthenticated, isActive, homePath, navigate]);

  const blocked = status && status !== "PENDING_APPROVAL";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-16">
      <div className="surface w-full max-w-md space-y-5 p-8 text-center">
        <Logo className="mx-auto size-14 shadow-soft" />
        {blocked ? (
          <ShieldAlert className="mx-auto size-9 text-destructive" strokeWidth={1.6} />
        ) : (
          <Clock className="mx-auto size-9 text-gold" strokeWidth={1.6} />
        )}
        <div className="space-y-1.5">
          <h1 className="text-xl font-medium text-primary">
            {status ? STATUS_LABEL[status] : "Account review"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {(status && MESSAGE[status]) ?? MESSAGE["PENDING_APPROVAL"]}
          </p>
          {profile?.email && <p className="text-xs text-muted-foreground">{profile.email}</p>}
        </div>
        <div className="flex justify-center gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => void refresh()}>
            Check again
          </Button>
          <Button
            className="rounded-full"
            onClick={async () => {
              await signOut();
              navigate({ to: "/", replace: true });
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
