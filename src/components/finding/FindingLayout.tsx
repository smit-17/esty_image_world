import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

const TABS = [
  { to: "/finding", label: "Dashboard" },
  { to: "/finding/save", label: "Finding Save" },
  { to: "/finding/all", label: "All Findings" },
  { to: "/finding/assigned", label: "Assigned" },
  { to: "/finding/settings", label: "Settings" },
  { to: "/finding/activity", label: "Activity Log" },
] as const;

/** Compact page header + section tabs shared by every Finding page. */
export function FindingLayout({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-semibold text-primary lg:text-2xl">{title}</h1>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>

      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const active = pathname === t.to || (t.to !== "/finding" && pathname.startsWith(t.to));
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
