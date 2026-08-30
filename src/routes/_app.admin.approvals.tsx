import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { assignRole, fetchRoles, fetchUsers, setUserStatus } from "@/lib/admin";
import { useState } from "react";

export const Route = createFileRoute("/_app/admin/approvals")({
  head: () => ({
    meta: [
      { title: "Registration approvals — LEPDO Lifestyle" },
      { name: "description", content: "Review and approve new LEPDO Lifestyle account registrations." },
      { property: "og:title", content: "Registration approvals — LEPDO Lifestyle" },
      { property: "og:description", content: "Review pending account registrations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const qc = useQueryClient();
  const { audit } = useAuth();
  const [roleChoice, setRoleChoice] = useState<Record<string, string>>({});

  const users = useQuery({ queryKey: ["admin-users"], queryFn: fetchUsers });
  const roles = useQuery({ queryKey: ["admin-roles"], queryFn: fetchRoles });
  const pending = (users.data ?? []).filter((u) => u.status === "PENDING_APPROVAL");

  async function decide(id: string, approve: boolean) {
    try {
      if (approve) {
        const roleId = roleChoice[id] ?? (roles.data ?? []).find((r) => r.code === "STAFF")?.id;
        if (roleId) await assignRole(id, roleId);
        await setUserStatus(id, "ACTIVE", "Registration approved");
      } else {
        await setUserStatus(id, "REJECTED", "Registration rejected");
      }
      audit({
        action: approve ? "USER_APPROVED" : "USER_REJECTED",
        module: "Users",
        entityType: "profile",
        entityId: id,
        description: approve ? "Registration approved" : "Registration rejected",
      });
      toast.success(approve ? "Account approved" : "Registration rejected");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {pending.length} registration{pending.length === 1 ? "" : "s"} waiting for review.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {pending.map((u) => (
          <div key={u.id} className="surface space-y-3 p-5">
            <div>
              <p className="font-medium">{u.full_name ?? u.username}</p>
              <p className="text-xs text-muted-foreground">
                @{u.username} · {u.email}
                {u.mobile ? ` · ${u.mobile}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Requested {new Date(u.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={roleChoice[u.id] ?? (roles.data ?? []).find((r) => r.code === "STAFF")?.id ?? ""}
                onValueChange={(v) => setRoleChoice((s) => ({ ...s, [u.id]: v }))}
              >
                <SelectTrigger className="h-9 w-40 rounded-lg">
                  <SelectValue placeholder="Assign role" />
                </SelectTrigger>
                <SelectContent>
                  {(roles.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="rounded-full" onClick={() => decide(u.id, true)}>
                <Check className="size-4" /> Approve
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => decide(u.id, false)}>
                <X className="size-4" /> Reject
              </Button>
            </div>
          </div>
        ))}
        {!pending.length && (
          <div className="surface p-8 text-center text-sm text-muted-foreground md:col-span-2">
            {users.isLoading ? "Loading…" : "No pending registrations."}
          </div>
        )}
      </div>
    </div>
  );
}
