import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { fetchPermissions, fetchRolePermissions, fetchRoles, setRolePermission } from "@/lib/admin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin/roles")({
  head: () => ({
    meta: [
      { title: "Roles & permissions — LEPDO Lifestyle" },
      { name: "description", content: "Configure what each LEPDO Lifestyle role is allowed to do." },
      { property: "og:title", content: "Roles & permissions — LEPDO Lifestyle" },
      { property: "og:description", content: "Configure role permissions for the workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RolesPage,
});

function RolesPage() {
  const qc = useQueryClient();
  const { audit, isSuperAdmin } = useAuth();
  const roles = useQuery({ queryKey: ["admin-roles"], queryFn: fetchRoles });
  const permissions = useQuery({ queryKey: ["admin-permissions"], queryFn: fetchPermissions });
  const links = useQuery({ queryKey: ["admin-role-permissions"], queryFn: fetchRolePermissions });
  const [activeRole, setActiveRole] = useState<string | null>(null);

  const roleList = roles.data ?? [];
  const current = roleList.find((r) => r.id === activeRole) ?? roleList[0];

  const grouped = useMemo(() => {
    const map = new Map<string, typeof permissions.data>();
    for (const p of permissions.data ?? []) {
      map.set(p.module, [...(map.get(p.module) ?? []), p]);
    }
    return [...map.entries()];
  }, [permissions.data]);

  const granted = new Set(
    (links.data ?? []).filter((l) => l.role_id === current?.id).map((l) => l.permission_id),
  );

  async function toggle(permissionId: string, enabled: boolean, code: string) {
    if (!current) return;
    try {
      await setRolePermission(current.id, permissionId, enabled);
      audit({
        action: "ROLE_PERMISSION_CHANGE",
        module: "Users",
        entityType: "role",
        entityId: current.id,
        newValues: { code, enabled },
        description: `${enabled ? "Granted" : "Revoked"} ${code} for ${current.name}`,
      });
      qc.invalidateQueries({ queryKey: ["admin-role-permissions"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <aside className="surface h-fit space-y-1 p-3">
        {roleList.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveRole(r.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
              current?.id === r.id ? "bg-secondary font-medium" : "hover:bg-secondary/60",
            )}
          >
            {r.name}
            {r.is_super_admin && <Badge variant="secondary">All</Badge>}
          </button>
        ))}
      </aside>

      <section className="surface space-y-5 p-5">
        {current?.is_super_admin ? (
          <p className="text-sm text-muted-foreground">
            Super Admin always holds every permission and cannot be restricted.
          </p>
        ) : (
          grouped.map(([module, perms]) => (
            <div key={module} className="space-y-2">
              <h3 className="text-eyebrow">{module}</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(perms ?? []).map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={granted.has(p.id)}
                      disabled={!isSuperAdmin}
                      onCheckedChange={(v) => toggle(p.id, v === true, p.code)}
                    />
                    <span className="truncate">{p.description ?? p.code}</span>
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
