import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { FindingGate } from "@/components/finding/FindingGate";
import { FindingLayout } from "@/components/finding/FindingLayout";
import {
  fetchFindingActivity,
  fetchFindingMembers,
  fetchFindings,
  formatDateTime,
} from "@/lib/findings";

export const Route = createFileRoute("/_app/finding/")({
  head: () => ({
    meta: [
      { title: "Finding Dashboard — LEPDO Lifestyle" },
      { name: "description", content: "Summary of jewelry findings, assignments and work status." },
      { property: "og:title", content: "Finding Dashboard — LEPDO Lifestyle" },
      { property: "og:description", content: "Summary of jewelry findings and assignment status." },
    ],
  }),
  component: () => (
    <FindingGate>
      <FindingDashboard />
    </FindingGate>
  ),
});

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-3 py-2.5">
      <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-primary">{value}</p>
    </div>
  );
}

function FindingDashboard() {
  const { data: findings = [] } = useQuery({ queryKey: ["findings"], queryFn: fetchFindings });
  const { data: members = [] } = useQuery({ queryKey: ["finding-members"], queryFn: fetchFindingMembers });
  const { data: activity = [] } = useQuery({
    queryKey: ["finding-activity"],
    queryFn: () => fetchFindingActivity(200),
  });

  const { tiles, platforms, team } = useMemo(() => {
    const today = new Date().toDateString();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const count = (fn: (f: (typeof findings)[number]) => boolean) => findings.filter(fn).length;

    const platformMap = new Map<string, number>();
    for (const f of findings) platformMap.set(f.platform, (platformMap.get(f.platform) ?? 0) + 1);

    return {
      tiles: [
        { label: "Total", value: findings.length },
        { label: "Today", value: count((f) => new Date(f.created_at).toDateString() === today) },
        { label: "This week", value: count((f) => new Date(f.created_at).getTime() >= weekAgo) },
        { label: "Assigned", value: count((f) => !!f.assigned_to) },
        { label: "Unassigned", value: count((f) => !f.assigned_to) },
        { label: "Pending", value: count((f) => f.status === "Pending") },
        { label: "Done", value: count((f) => f.status === "Done") },
        { label: "Rework", value: count((f) => f.status === "Rework") },
        { label: "Rejected", value: count((f) => f.status === "Rejected") },
        { label: "On Hold", value: count((f) => f.status === "On Hold") },
      ],
      platforms: [...platformMap.entries()].sort((a, b) => b[1] - a[1]),
      team: members.map((m) => {
        const mine = findings.filter((f) => f.assigned_to === m.name);
        return {
          name: m.name,
          assigned: mine.length,
          pending: mine.filter((f) => f.status === "Pending").length,
          done: mine.filter((f) => f.status === "Done").length,
        };
      }),
    };
  }, [findings, members]);

  return (
    <FindingLayout title="Finding Dashboard">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Tile key={t.label} {...t} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="rounded-xl border border-border/70 bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform summary</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {platforms.map(([name, n]) => (
              <li key={name} className="flex justify-between gap-3">
                <span className="truncate">{name}</span>
                <span className="font-medium text-primary">{n}</span>
              </li>
            ))}
            {platforms.length === 0 && <li className="text-muted-foreground">No findings yet.</li>}
          </ul>
        </section>

        <section className="rounded-xl border border-border/70 bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team performance</p>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="pb-1">Member</th>
                <th className="pb-1 text-right">Assigned</th>
                <th className="pb-1 text-right">Pending</th>
                <th className="pb-1 text-right">Done</th>
              </tr>
            </thead>
            <tbody>
              {team.map((t) => (
                <tr key={t.name}>
                  <td className="truncate py-0.5">{t.name}</td>
                  <td className="py-0.5 text-right">{t.assigned}</td>
                  <td className="py-0.5 text-right">{t.pending}</td>
                  <td className="py-0.5 text-right">{t.done}</td>
                </tr>
              ))}
              {team.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-2 text-muted-foreground">
                    Add team members in Settings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-border/70 bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent activity</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {activity.slice(0, 8).map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span className="truncate">
                  <span className="font-medium">{a.finding_code ?? "—"}</span> {a.activity}
                  <span className="text-muted-foreground"> · {a.user_name ?? "—"}</span>
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(a.created_at)}
                </span>
              </li>
            ))}
            {activity.length === 0 && <li className="text-muted-foreground">No activity yet.</li>}
          </ul>
        </section>
      </div>
    </FindingLayout>
  );
}
