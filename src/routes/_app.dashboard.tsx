import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Gem,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  HardDrive,
  Images,
  Users,
  Clock,
} from "lucide-react";

import { EtsyOverview } from "@/components/EtsyOverview";
import {
  fetchImages,
  fetchProducts,
  fetchTeam,
  fetchCategories,
  formatBytes,
  formatDate,
  STORAGE_QUOTA_BYTES,
} from "@/lib/lepdo";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — LEPDO Lifestyle Image Manager" },
      {
        name: "description",
        content: "Live analytics for LEPDO Lifestyle's AI jewelry image library.",
      },
      { property: "og:title", content: "Dashboard — LEPDO Lifestyle" },
      { property: "og:description", content: "Live analytics for the LEPDO jewelry image library." },
    ],
  }),
  component: DashboardPage,
});

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="surface p-5 transition-shadow duration-300 hover:shadow-lift">
      <div className="flex items-start justify-between">
        <p className="text-eyebrow">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-4 text-stat text-3xl text-primary">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface p-6">
      <h3 className="text-lg">{title}</h3>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function DashboardPage() {
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: images = [] } = useQuery({ queryKey: ["images", "all"], queryFn: () => fetchImages() });
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: fetchTeam });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const now = Date.now();
  const since = (days: number) => products.filter((p) => now - new Date(p.created_at).getTime() <= days * 86400000).length;
  const today = products.filter(
    (p) => new Date(p.created_at).toDateString() === new Date().toDateString(),
  ).length;

  const used = images.reduce((sum, i) => sum + Number(i.size_bytes ?? 0), 0);
  const pct = Math.min(100, (used / STORAGE_QUOTA_BYTES) * 100);

  const byCategory = categories.map((c) => ({
    name: c.name,
    count: products.filter((p) => p.category === c.name).length,
  }));
  const maxCat = Math.max(1, ...byCategory.map((c) => c.count));

  const byMember = team
    .map((t) => ({ name: t.name, count: products.filter((p) => p.team_member === t.name).length }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-eyebrow">Overview</p>
        <h1 className="mt-1 text-3xl text-primary lg:text-4xl">Studio at a glance</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total products" value={products.length} icon={Gem} />
        <StatCard label="Added today" value={today} icon={CalendarCheck} />
        <StatCard label="Last 7 days" value={since(7)} icon={CalendarDays} />
        <StatCard label="Last 30 days" value={since(30)} icon={CalendarRange} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard label="Total images" value={images.length} icon={Images} />
        <StatCard label="Storage used" value={formatBytes(used)} hint={`${pct.toFixed(1)}% of ${formatBytes(STORAGE_QUOTA_BYTES)}`} icon={HardDrive} />
        <StatCard label="Team members" value={team.length} icon={Users} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Category statistics">
          <ul className="space-y-3.5">
            {byCategory.map((c) => (
              <li key={c.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{c.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${(c.count / maxCat) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Listings by team member">
          {byMember.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <ul className="space-y-3">
              {byMember.map((m) => (
                <li key={m.name} className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-sm">{m.name}</span>
                  <span className="ml-auto text-sm text-muted-foreground">{m.count} products</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <EtsyOverview products={products} categories={categories} team={team} />

      <Panel title="Recent upload activity">
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing uploaded yet —{" "}
            <Link to="/products/new" className="text-primary underline underline-offset-4">
              add your first product
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {products.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <Clock className="size-4 text-gold" strokeWidth={1.75} />
                <Link to="/products/$id" params={{ id: p.id }} className="truncate text-sm hover:underline">
                  {p.name}
                </Link>
                <span className="hidden text-xs text-muted-foreground sm:inline">· {p.category}</span>
                <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                  {p.team_member} · {formatDate(p.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
