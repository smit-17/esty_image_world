import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Store, CheckCircle2, CircleDashed, CalendarCheck, CalendarDays, CalendarRange } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EtsyStatusBadge } from "@/components/EtsyPanel";
import { ETSY_STATUSES, formatDate, type Product } from "@/lib/lepdo";

const ALL = "__all__";

function Tile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between">
        <p className="text-eyebrow">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-4 text-stat text-3xl text-primary">{value}</p>
    </div>
  );
}

export function EtsyOverview({
  products,
  categories,
  team,
}: {
  products: Product[];
  categories: { id: string; name: string }[];
  team: { id: string; name: string }[];
}) {
  const [account, setAccount] = useState(ALL);
  const [member, setMember] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [range, setRange] = useState(ALL);

  const accounts = useMemo(
    () =>
      Array.from(
        new Set(products.map((p) => (p.etsy_account ?? "").trim()).filter(Boolean)),
      ).sort(),
    [products],
  );

  const filtered = useMemo(() => {
    const now = Date.now();
    return products.filter((p) => {
      if (account !== ALL && (p.etsy_account ?? "") !== account) return false;
      if (member !== ALL && (p.etsy_listed_by ?? p.team_member) !== member) return false;
      if (category !== ALL && p.category !== category) return false;
      if (status !== ALL && (p.etsy_status ?? "not_listed") !== status) return false;
      if (range !== ALL) {
        const when = p.etsy_listed_at ?? p.created_at;
        if (now - new Date(when).getTime() > Number(range) * 86400000) return false;
      }
      return true;
    });
  }, [products, account, member, category, status, range]);

  const listed = filtered.filter((p) => (p.etsy_status ?? "not_listed") !== "not_listed");
  const notListed = filtered.length - listed.length;

  const now = new Date();
  const listedSince = (days: number) =>
    listed.filter(
      (p) => p.etsy_listed_at && now.getTime() - new Date(p.etsy_listed_at).getTime() <= days * 86400000,
    ).length;
  const listedToday = listed.filter(
    (p) => p.etsy_listed_at && new Date(p.etsy_listed_at).toDateString() === now.toDateString(),
  ).length;

  const byAccount = useMemo(() => {
    const map = new Map<
      string,
      { total: number; live: number; draft: number; deactivated: number; last: string | null }
    >();
    for (const p of listed) {
      const key = (p.etsy_account ?? "Unassigned").trim() || "Unassigned";
      const row = map.get(key) ?? { total: 0, live: 0, draft: 0, deactivated: 0, last: null };
      row.total += 1;
      if (p.etsy_status === "live") row.live += 1;
      if (p.etsy_status === "draft") row.draft += 1;
      if (p.etsy_status === "deactivated") row.deactivated += 1;
      if (p.etsy_listed_at && (!row.last || p.etsy_listed_at > row.last)) row.last = p.etsy_listed_at;
      map.set(key, row);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [listed]);

  const byMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of listed) {
      const key = p.etsy_listed_by ?? p.team_member;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [listed]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of listed) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [listed]);
  const maxCat = Math.max(1, ...byCategory.map(([, v]) => v));

  const recent = useMemo(
    () =>
      [...listed]
        .filter((p) => p.etsy_listed_at)
        .sort((a, b) => (a.etsy_listed_at! < b.etsy_listed_at! ? 1 : -1))
        .slice(0, 8),
    [listed],
  );

  return (
    <section className="space-y-5">
      <header className="flex items-center gap-2">
        <Store className="size-5 text-gold" strokeWidth={1.75} />
        <h2 className="text-2xl text-primary">Etsy listing overview</h2>
      </header>

      <div className="surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={account} onValueChange={setAccount}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Etsy account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={member} onValueChange={setMember}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Team member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All team members</SelectItem>
            {team.map((t) => (
              <SelectItem key={t.id} value={t.name}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Listing status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {ETSY_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any date</SelectItem>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Tile label="Listed on Etsy" value={listed.length} icon={CheckCircle2} />
        <Tile label="Not yet listed" value={notListed} icon={CircleDashed} />
        <Tile label="Listed today" value={listedToday} icon={CalendarCheck} />
        <Tile label="This week" value={listedSince(7)} icon={CalendarDays} />
        <Tile label="This month" value={listedSince(30)} icon={CalendarRange} />
      </div>

      <div className="surface overflow-hidden p-6">
        <h3 className="text-lg">Etsy accounts</h3>
        {byAccount.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No Etsy listings recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Account</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Live</th>
                  <th className="py-2 pr-4 font-medium">Draft</th>
                  <th className="py-2 pr-4 font-medium">Deactivated</th>
                  <th className="py-2 font-medium">Last listing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {byAccount.map(([name, row]) => (
                  <tr key={name}>
                    <td className="py-3 pr-4 font-medium">{name}</td>
                    <td className="py-3 pr-4">{row.total}</td>
                    <td className="py-3 pr-4">{row.live}</td>
                    <td className="py-3 pr-4">{row.draft}</td>
                    <td className="py-3 pr-4">{row.deactivated}</td>
                    <td className="py-3 text-muted-foreground">
                      {row.last ? formatDate(row.last) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="surface p-6">
          <h3 className="text-lg">Listings by team member</h3>
          {byMember.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No listings yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {byMember.map(([name, count]) => (
                <li key={name} className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">
                    {name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-sm">{name}</span>
                  <span className="ml-auto text-sm text-muted-foreground">{count} listings</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface p-6">
          <h3 className="text-lg">Category-wise listings</h3>
          {byCategory.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No listings yet.</p>
          ) : (
            <ul className="mt-4 space-y-3.5">
              {byCategory.map(([name, count]) => (
                <li key={name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span>{name}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gold transition-all duration-500"
                      style={{ width: `${(count / maxCat) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="surface p-6">
        <h3 className="text-lg">Recent Etsy activity</h3>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No Etsy listings recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {recent.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <EtsyStatusBadge status={p.etsy_status} />
                <Link
                  to="/products/$id"
                  params={{ id: p.id }}
                  className="truncate text-sm hover:underline"
                >
                  {p.name}
                </Link>
                <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                  {p.etsy_account ?? "—"} · {p.etsy_listed_by ?? p.team_member} ·{" "}
                  {p.etsy_listed_at ? formatDate(p.etsy_listed_at) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
