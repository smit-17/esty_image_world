import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Gem,
  Images,
  PlusCircle,
  Tags,
  Users,
  HardDrive,
  Settings,
  Menu,
  Scale,
  X,
  LogOut,
  Search,
  UserCog,
  ShieldCheck,
  ScrollText,
  KeyRound,
  UserCircle,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { isRouteAllowed, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Gem },
  { to: "/products/new", label: "Add Product", icon: PlusCircle },
  { to: "/images", label: "All Images", icon: Images },
  { to: "/estimates", label: "Metal & Diamond", icon: Scale },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/team", label: "Team Members", icon: Users },
  { to: "/storage", label: "Storage", icon: HardDrive },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const FINDING_NAV = [{ to: "/finding", label: "Finding", icon: Search }] as const;

const ADMIN_NAV = [
  { to: "/admin/users", label: "Users", icon: UserCog, permission: "USER_VIEW" },
  { to: "/admin/approvals", label: "Approvals", icon: ShieldCheck, permission: "USER_APPROVE" },
  { to: "/admin/roles", label: "Roles & Permissions", icon: KeyRound, permission: "USER_MANAGE_ROLES" },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText, permission: "AUDIT_VIEW" },
] as const;

const ACCOUNT_NAV = [{ to: "/profile", label: "My Profile", icon: UserCircle }] as const;

export function AppShell() {
  const { ready, isAuthenticated, isActive, can, signOut, homePath, profile, roles } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (!isActive) {
      navigate({ to: "/pending", replace: true });
      return;
    }
    if (!isRouteAllowed(pathname, can)) {
      navigate({ to: homePath, replace: true });
    }
  }, [ready, isAuthenticated, isActive, can, pathname, homePath, navigate]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!ready || !isAuthenticated || !isActive || !isRouteAllowed(pathname, can)) {
    return <div className="min-h-screen bg-background" />;
  }

  const nav = NAV.filter((item) => isRouteAllowed(item.to, can));
  const findingNav = FINDING_NAV.filter((item) => isRouteAllowed(item.to, can));
  const adminNav = ADMIN_NAV.filter((item) => can(item.permission));
  const allNav = [...nav, ...findingNav, ...adminNav, ...ACCOUNT_NAV];
  const current =
    allNav.find((n) => pathname === n.to) ??
    [...allNav].sort((a, b) => b.to.length - a.to.length).find((n) => pathname.startsWith(n.to));

  const roleLabel = roles[0]?.name ?? "Member";

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
    );

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
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto bg-sidebar px-5 py-7 transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 px-1">
          <Logo className="size-11 shadow-soft" />
          <div className="leading-tight">
            <p className="font-display text-xl text-sidebar-foreground">Lepdo</p>
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-sidebar-foreground/60">
              {roleLabel}
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

        <nav className="mt-9 flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className={linkClass(pathname === item.to)}>
              <item.icon className="size-[18px]" strokeWidth={1.75} />
              {item.label}
            </Link>
          ))}
          {findingNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={linkClass(pathname === item.to || pathname.startsWith(`${item.to}/`))}
            >
              <item.icon className="size-[18px]" strokeWidth={1.75} />
              {item.label}
            </Link>
          ))}

          {adminNav.length > 0 && (
            <>
              <p className="mt-5 px-3.5 text-[0.6rem] uppercase tracking-[0.22em] text-sidebar-foreground/45">
                Administration
              </p>
              {adminNav.map((item) => (
                <Link key={item.to} to={item.to} className={linkClass(pathname === item.to)}>
                  <item.icon className="size-[18px]" strokeWidth={1.75} />
                  {item.label}
                </Link>
              ))}
            </>
          )}

          <p className="mt-5 px-3.5 text-[0.6rem] uppercase tracking-[0.22em] text-sidebar-foreground/45">
            Account
          </p>
          {ACCOUNT_NAV.map((item) => (
            <Link key={item.to} to={item.to} className={linkClass(pathname === item.to)}>
              <item.icon className="size-[18px]" strokeWidth={1.75} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 rounded-xl bg-sidebar-accent/40 px-3.5 py-3">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {profile?.full_name ?? profile?.username ?? "Account"}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/60">{profile?.email}</p>
        </div>

        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/", replace: true });
          }}
          className="mt-2 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <LogOut className="size-[18px]" strokeWidth={1.75} /> Sign out
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
          {can("PRODUCT_ADD") && (
            <div className="ml-auto hidden sm:block">
              <Button asChild variant="default" className="rounded-full px-5">
                <Link to="/products/new">
                  <PlusCircle className="size-4" /> Add Product
                </Link>
              </Button>
            </div>
          )}
        </header>

        <main className="flex-1 px-4 py-5 lg:px-8 lg:py-6">
          <Outlet />
        </main>
      </div>

      {can("PRODUCT_ADD") && (
        <Link
          to="/products/new"
          className="fixed bottom-6 right-6 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform hover:scale-105 sm:hidden"
          aria-label="Add product"
        >
          <PlusCircle className="size-6" strokeWidth={1.75} />
        </Link>
      )}
    </div>
  );
}
