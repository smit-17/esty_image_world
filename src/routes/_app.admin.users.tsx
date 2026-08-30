import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { STATUS_LABEL, useAuth, type UserStatus } from "@/lib/auth";
import { assignRole, fetchRoles, fetchUsers, removeRole, setUserStatus } from "@/lib/admin";

export const Route = createFileRoute("/_app/admin/users")({
  head: () => ({
    meta: [
      { title: "User management — LEPDO Lifestyle" },
      { name: "description", content: "Manage LEPDO Lifestyle workspace accounts, roles and account status." },
      { property: "og:title", content: "User management — LEPDO Lifestyle" },
      { property: "og:description", content: "Manage workspace accounts, roles and status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

const STATUSES: UserStatus[] = [
  "ACTIVE",
  "PENDING_APPROVAL",
  "INACTIVE",
  "SUSPENDED",
  "BLOCKED",
  "REJECTED",
];

function UsersPage() {
  const qc = useQueryClient();
  const { can, audit, user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const users = useQuery({ queryKey: ["admin-users"], queryFn: fetchUsers });
  const roles = useQuery({ queryKey: ["admin-roles"], queryFn: fetchRoles });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users.data ?? []).filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (!q) return true;
      return [u.full_name, u.username, u.email, u.mobile]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [users.data, search, statusFilter]);

  async function changeStatus(id: string, status: UserStatus) {
    try {
      await setUserStatus(id, status);
      audit({
        action: "USER_STATUS_CHANGE",
        module: "Users",
        entityType: "profile",
        entityId: id,
        newValues: { status },
        description: `Status set to ${status}`,
      });
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function changeRole(userId: string, roleId: string, currentRoleId?: string) {
    try {
      if (currentRoleId) await removeRole(userId, currentRoleId);
      if (roleId !== "none") await assignRole(userId, roleId);
      audit({
        action: "USER_ROLE_CHANGE",
        module: "Users",
        entityType: "profile",
        entityId: userId,
        newValues: { roleId },
        description: "Role updated",
      });
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name, username, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 max-w-xs rounded-xl"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-44 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{rows.length} accounts</span>
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const roleId = u.roles[0]?.id;
              const isSelf = u.id === user?.id;
              return (
                <tr key={u.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.full_name ?? u.username ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">@{u.username ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <p>{u.email}</p>
                    <p>{u.mobile}</p>
                  </td>
                  <td className="px-4 py-3">
                    {can("USER_MANAGE_ROLES") ? (
                      <Select
                        value={roleId ?? "none"}
                        onValueChange={(v) => changeRole(u.id, v, roleId)}
                      >
                        <SelectTrigger className="h-9 w-40 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No role</SelectItem>
                          {(roles.data ?? []).map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{u.roles[0]?.name ?? "No role"}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {can("USER_APPROVE") && !isSelf ? (
                      <Select value={u.status} onValueChange={(v) => changeStatus(u.id, v as UserStatus)}>
                        <SelectTrigger className="h-9 w-44 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={u.status === "ACTIVE" ? "default" : "secondary"}>
                        {STATUS_LABEL[u.status]}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {users.isLoading ? "Loading accounts…" : "No accounts match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
