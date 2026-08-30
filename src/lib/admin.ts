import { supabase } from "@/integrations/supabase/client";
import type { PermissionRow, Profile, RoleRow, UserStatus } from "@/lib/auth";

export type ManagedUser = Profile & { roles: RoleRow[] };

export async function fetchRoles(): Promise<RoleRow[]> {
  const { data, error } = await supabase.from("roles" as never).select("*").order("name");
  if (error) throw error;
  return (data ?? []) as unknown as RoleRow[];
}

export async function fetchPermissions(): Promise<PermissionRow[]> {
  const { data, error } = await supabase
    .from("permissions" as never)
    .select("*")
    .order("module")
    .order("action");
  if (error) throw error;
  return (data ?? []) as unknown as PermissionRow[];
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  const [{ data: profiles, error }, { data: links }] = await Promise.all([
    supabase.from("profiles" as never).select("*").order("created_at", { ascending: false }),
    supabase.from("user_roles" as never).select("user_id, removed_at, roles(*)"),
  ]);
  if (error) throw error;
  const byUser = new Map<string, RoleRow[]>();
  for (const row of (links ?? []) as unknown as {
    user_id: string;
    removed_at: string | null;
    roles: RoleRow | null;
  }[]) {
    if (row.removed_at || !row.roles) continue;
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row.roles]);
  }
  return ((profiles ?? []) as unknown as Profile[]).map((p) => ({
    ...p,
    roles: byUser.get(p.id) ?? [],
  }));
}

export async function setUserStatus(userId: string, status: UserStatus, reason?: string) {
  const { error } = await supabase.rpc("set_user_status" as never, {
    _user_id: userId,
    _status: status,
    _reason: reason ?? null,
  } as never);
  if (error) throw error;
}

export async function assignRole(userId: string, roleId: string) {
  const { error } = await supabase
    .from("user_roles" as never)
    .insert({ user_id: userId, role_id: roleId } as never);
  if (error) throw error;
}

export async function removeRole(userId: string, roleId: string) {
  const { error } = await supabase
    .from("user_roles" as never)
    .delete()
    .eq("user_id", userId)
    .eq("role_id", roleId);
  if (error) throw error;
}

export async function fetchRolePermissions(): Promise<{ role_id: string; permission_id: string }[]> {
  const { data, error } = await supabase
    .from("role_permissions" as never)
    .select("role_id, permission_id");
  if (error) throw error;
  return (data ?? []) as unknown as { role_id: string; permission_id: string }[];
}

export async function setRolePermission(roleId: string, permissionId: string, enabled: boolean) {
  if (enabled) {
    const { error } = await supabase
      .from("role_permissions" as never)
      .insert({ role_id: roleId, permission_id: permissionId } as never);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("role_permissions" as never)
      .delete()
      .eq("role_id", roleId)
      .eq("permission_id", permissionId);
    if (error) throw error;
  }
}

export type AuditLog = {
  id: string;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  module: string | null;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
};

export async function fetchAuditLogs(limit = 200): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as AuditLog[];
}
