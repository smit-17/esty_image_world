import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAuditLogs } from "@/lib/admin";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit log — LEPDO Lifestyle" },
      { name: "description", content: "Full activity trail of every action taken in the LEPDO Lifestyle workspace." },
      { property: "og:title", content: "Audit log — LEPDO Lifestyle" },
      { property: "og:description", content: "Activity trail of workspace actions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const logs = useQuery({ queryKey: ["audit-logs"], queryFn: () => fetchAuditLogs(500) });

  const modules = useMemo(
    () => Array.from(new Set((logs.data ?? []).map((l) => l.module).filter(Boolean))) as string[],
    [logs.data],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (logs.data ?? []).filter((l) => {
      if (moduleFilter !== "all" && l.module !== moduleFilter) return false;
      if (!q) return true;
      return [l.user_name, l.user_email, l.action, l.description, l.entity_id]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [logs.data, search, moduleFilter]);

  function exportCsv() {
    const header = ["When", "User", "Email", "Role", "Action", "Module", "Description", "Device", "Success"];
    const body = rows.map((l) => [
      new Date(l.created_at).toISOString(),
      l.user_name ?? "",
      l.user_email ?? "",
      l.user_role ?? "",
      l.action,
      l.module ?? "",
      l.description ?? "",
      [l.device, l.browser, l.os].filter(Boolean).join(" / "),
      l.success ? "yes" : "no",
    ]);
    const csv = [header, ...body]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lepdo-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search user, action, description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 max-w-xs rounded-xl"
        />
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="h-10 w-40 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{rows.length} entries</span>
        {can("AUDIT_EXPORT") && (
          <Button variant="outline" className="ml-auto rounded-full" onClick={exportCsv}>
            Export CSV
          </Button>
        )}
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">Device</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-b border-border/40 last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-xs font-medium">{l.user_name ?? "—"}</p>
                  <p className="text-[0.7rem] text-muted-foreground">{l.user_email}</p>
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={l.success ? "secondary" : "destructive"}>{l.action}</Badge>
                  {l.module && <p className="mt-1 text-[0.7rem] text-muted-foreground">{l.module}</p>}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {l.description ?? l.failure_reason ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-[0.7rem] text-muted-foreground">
                  {[l.device, l.browser, l.os].filter(Boolean).join(" / ")}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {logs.isLoading ? "Loading activity…" : "No activity recorded yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
