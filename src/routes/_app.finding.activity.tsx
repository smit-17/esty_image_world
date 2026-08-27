import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { FindingGate } from "@/components/finding/FindingGate";
import { FindingLayout } from "@/components/finding/FindingLayout";
import { fetchFindingActivity, formatDateTime } from "@/lib/findings";

export const Route = createFileRoute("/_app/finding/activity")({
  head: () => ({
    meta: [
      { title: "Finding Activity Log — LEPDO Lifestyle" },
      { name: "description", content: "History of finding creation, edits, assignments and status changes." },
      { property: "og:title", content: "Finding Activity Log — LEPDO Lifestyle" },
      { property: "og:description", content: "Who changed which finding, and when." },
    ],
  }),
  component: () => (
    <FindingGate>
      <ActivityPage />
    </FindingGate>
  ),
});

function ActivityPage() {
  const { data: rows = [] } = useQuery({
    queryKey: ["finding-activity"],
    queryFn: () => fetchFindingActivity(300),
  });

  return (
    <FindingLayout title="Activity Log">

      <div className="w-full overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2">Date &amp; time</th>
              <th className="p-2">User</th>
              <th className="p-2">Finding ID</th>
              <th className="p-2">Activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/70">
                <td className="p-2 whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</td>
                <td className="p-2">{r.user_name ?? "—"}</td>
                <td className="p-2 font-medium">{r.finding_code ?? "—"}</td>
                <td className="p-2">{r.activity}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  No activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </FindingLayout>
  );
}
