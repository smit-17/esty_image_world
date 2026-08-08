import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Gem,
  PlusCircle,
  Tags,
  Users,
  HardDrive,
  Settings,
  Menu,
  X,
  Lock,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { useGate } from "@/lib/gate";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Gem },
  { to: "/products/new", label: "Add Product", icon: PlusCircle },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/team", label: "Team Members", icon: Users },
  { to: "/storage", label: "Storage", icon: HardDrive },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell() {
  const { ready, unlocked, lock } = useGate();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (ready && !unlocked) navigate({ to: "/", replace: true });
  }, [ready, unlocked, navigate]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!ready || !unlocked) {
    return <div className="min-h-screen bg-background" />;
  }

  const current = NAV.find((n) => pathname === n.to) ?? NAV.find((n) => pathname.startsWith(n.to));

  return (
    <div className="flex min-h-screen bg-background">
      {open && (
        <button
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-primary/30 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-sidebar px-5 py-7 transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 px-1">
          <Logo className="size-11 shadow-soft" />
          <div className="leading-tight">
            <p className="font-display text-xl text-sidebar-foreground">Lepdo</p>
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-sidebar-foreground/60">
              Lifestyle
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto text-sidebar-foreground/70 lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="size-[18px]" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => {
            lock();
            navigate({ to: "/", replace: true });
          }}
          className="mt-6 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <Lock className="size-[18px]" strokeWidth={1.75} /> Lock workspace
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/70 bg-background/85 px-5 py-4 backdrop-blur-xl lg:px-10">
          <button onClick={() => setOpen(true)} className="lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Logo className="size-8 lg:hidden" />
          <div className="min-w-0">
            <p className="text-eyebrow">LEPDO Lifestyle</p>
            <h2 className="truncate text-lg font-medium">{current?.label ?? "Dashboard"}</h2>
          </div>
          <div className="ml-auto hidden sm:block">
            <Button asChild variant="default" className="rounded-full px-5">
              <Link to="/products/new">
                <PlusCircle className="size-4" /> Add Product
              </Link>
            </Button>
          </div>
        </header>

        <main className="flex-1 px-5 py-7 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>

      <Link
        to="/products/new"
        className="fixed bottom-6 right-6 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform hover:scale-105 sm:hidden"
        aria-label="Add product"
      >
        <PlusCircle className="size-6" strokeWidth={1.75} />
      </Link>
    </div>
  );
}
