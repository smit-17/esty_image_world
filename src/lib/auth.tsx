import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type UserStatus =
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "INACTIVE"
  | "REJECTED"
  | "BLOCKED"
  | "SUSPENDED";

export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

export type RoleRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_system: boolean;
  is_super_admin: boolean;
};

export type PermissionRow = {
  id: string;
  module: string;
  action: string;
  code: string;
  description: string | null;
};

export const PERMISSION_MODULES = [
  "Products",
  "Images",
  "Estimates",
  "Findings",
  "Users",
  "Audit",
  "Settings",
] as const;

export const STATUS_LABEL: Record<UserStatus, string> = {
  PENDING_APPROVAL: "Pending approval",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  REJECTED: "Rejected",
  BLOCKED: "Blocked",
  SUSPENDED: "Suspended",
};

/* ------------------------------------------------------------------ */
/* Non-React snapshot (used by data helpers)                           */
/* ------------------------------------------------------------------ */

type Snapshot = {
  userId: string | null;
  email: string | null;
  name: string | null;
  roleCode: string | null;
  isSuperAdmin: boolean;
  status: UserStatus | null;
  permissions: Set<string>;
};

const snapshot: Snapshot = {
  userId: null,
  email: null,
  name: null,
  roleCode: null,
  isSuperAdmin: false,
  status: null,
  permissions: new Set(),
};

export function authSnapshot() {
  return snapshot;
}

export function hasPerm(code: string) {
  return snapshot.isSuperAdmin || snapshot.permissions.has(code);
}

/** Throws unless the signed-in user holds the permission. */
export function assertPerm(code: string, action = "this action") {
  if (!hasPerm(code)) throw new Error(`Your role does not allow ${action}`);
}

export function currentActor() {
  return {
    id: snapshot.userId,
    name: snapshot.name,
    email: snapshot.email,
    role: snapshot.roleCode,
  };
}

/* ------------------------------------------------------------------ */
/* Route access map                                                    */
/* ------------------------------------------------------------------ */

const ROUTE_PERMISSIONS: { prefix: string; permission: string | null }[] = [
  { prefix: "/admin/audit", permission: "AUDIT_VIEW" },
  { prefix: "/admin", permission: "USER_VIEW" },
  { prefix: "/profile", permission: null },
  { prefix: "/dashboard", permission: "PRODUCT_VIEW" },
  { prefix: "/products/new", permission: "PRODUCT_ADD" },
  { prefix: "/products", permission: "PRODUCT_VIEW" },
  { prefix: "/images", permission: "PRODUCT_VIEW" },
  { prefix: "/estimates", permission: "ESTIMATE_VIEW" },
  { prefix: "/finding", permission: "FINDING_VIEW" },
  { prefix: "/categories", permission: "SETTINGS_VIEW" },
  { prefix: "/team", permission: "SETTINGS_VIEW" },
  { prefix: "/storage", permission: "SETTINGS_VIEW" },
  { prefix: "/settings", permission: "SETTINGS_VIEW" },
];

export function routePermission(pathname: string): string | null | undefined {
  const match = ROUTE_PERMISSIONS.filter(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match ? match.permission : undefined;
}

export function isRouteAllowed(pathname: string, can: (code: string) => boolean) {
  const perm = routePermission(pathname);
  if (perm === undefined) return true;
  if (perm === null) return true;
  return can(perm);
}

export function homePathFor(can: (code: string) => boolean) {
  if (can("PRODUCT_VIEW")) return "/dashboard";
  if (can("ESTIMATE_VIEW")) return "/estimates";
  if (can("FINDING_VIEW")) return "/finding";
  return "/profile";
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

type AuthValue = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: RoleRow[];
  permissions: string[];
  status: UserStatus | null;
  isAuthenticated: boolean;
  isActive: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  homePath: string;
  can: (code: string) => boolean;
  canAny: (codes: string[]) => boolean;
  canAll: (codes: string[]) => boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (input: {
    email: string;
    password: string;
    fullName: string;
    username: string;
    mobile?: string;
  }) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (next: string, current?: string) => Promise<{ error?: string }>;
  updateProfile: (patch: Partial<Profile>) => Promise<{ error?: string }>;
  audit: (entry: Parameters<typeof logAudit>[1]) => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const loadingRef = useRef(false);

  const clearState = useCallback(() => {
    setProfile(null);
    setRoles([]);
    setPermissions([]);
    snapshot.userId = null;
    snapshot.email = null;
    snapshot.name = null;
    snapshot.roleCode = null;
    snapshot.isSuperAdmin = false;
    snapshot.status = null;
    snapshot.permissions = new Set();
  }, []);

  const loadIdentity = useCallback(async (user: User) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const { data: profileRow } = await supabase.rpc("ensure_profile" as never, {} as never);
      const prof = (Array.isArray(profileRow) ? profileRow[0] : profileRow) as Profile | null;

      const [{ data: roleRows }, { data: permRows }] = await Promise.all([
        supabase.from("user_roles" as never).select("role_id, removed_at, roles(*)").eq("user_id", user.id),
        supabase.rpc("my_permission_codes" as never),
      ]);

      const activeRoles = ((roleRows ?? []) as unknown as { removed_at: string | null; roles: RoleRow }[])
        .filter((r) => !r.removed_at && r.roles)
        .map((r) => r.roles);
      const codes = ((permRows ?? []) as unknown as { code: string }[]).map((r) => r.code);

      setProfile(prof);
      setRoles(activeRoles);
      setPermissions(codes);

      snapshot.userId = user.id;
      snapshot.email = prof?.email ?? user.email ?? null;
      snapshot.name = prof?.full_name ?? prof?.username ?? user.email ?? null;
      snapshot.isSuperAdmin = activeRoles.some((r) => r.is_super_admin);
      snapshot.roleCode = activeRoles[0]?.code ?? null;
      snapshot.status = (prof?.status as UserStatus) ?? null;
      snapshot.permissions = new Set(codes);
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession?.user) {
        clearState();
        setReady(true);
        return;
      }
      if (event === "TOKEN_REFRESHED") return;
      setTimeout(() => {
        loadIdentity(nextSession.user).finally(() => mounted && setReady(true));
      }, 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        loadIdentity(data.session.user).finally(() => mounted && setReady(true));
      } else {
        clearState();
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [clearState, loadIdentity]);

  const isSuperAdmin = roles.some((r) => r.is_super_admin);
  const permSet = useMemo(() => new Set(permissions), [permissions]);
  const can = useCallback(
    (code: string) => isSuperAdmin || permSet.has(code),
    [isSuperAdmin, permSet],
  );

  const value: AuthValue = {
    ready,
    session,
    user: session?.user ?? null,
    profile,
    roles,
    permissions,
    status: (profile?.status as UserStatus) ?? null,
    isAuthenticated: !!session?.user,
    isActive: profile?.status === "ACTIVE",
    isSuperAdmin,
    isAdmin: isSuperAdmin || roles.some((r) => r.code === "ADMIN"),
    homePath: homePathFor(can),
    can,
    canAny: (codes) => codes.some(can),
    canAll: (codes) => codes.every(can),
    refresh: async () => {
      if (session?.user) await loadIdentity(session.user);
    },
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        void logAudit({ id: null, email }, {
          action: "LOGIN_FAILED",
          module: "Auth",
          success: false,
          failureReason: error.message,
          description: `Failed sign-in for ${email}`,
        });
        return { error: error.message };
      }
      if (data.user) {
        await loadIdentity(data.user);
        void logAudit(currentActor(), {
          action: "LOGIN",
          module: "Auth",
          description: "User signed in",
        });
      }
      return {};
    },
    signUp: async ({ email, password, fullName, username, mobile }) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName, username, mobile },
        },
      });
      if (error) return { error: error.message };
      if (data.session?.user) {
        const { error: rpcError } = await supabase.rpc("ensure_profile" as never, {
          _full_name: fullName,
          _username: username,
          _mobile: mobile ?? null,
        } as never);
        if (rpcError) return { error: rpcError.message };
        await loadIdentity(data.session.user);
        void logAudit(currentActor(), {
          action: "REGISTER",
          module: "Auth",
          description: `Registration submitted by ${email}`,
        });
      }
      return {};
    },
    signOut: async () => {
      void logAudit(currentActor(), { action: "LOGOUT", module: "Auth", description: "User signed out" });
      await supabase.auth.signOut();
      clearState();
    },
    forgotPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return error ? { error: error.message } : {};
    },
    updatePassword: async (next, current) => {
      const payload: { password: string; current_password?: string } = { password: next };
      if (current) payload.current_password = current;
      const { error } = await supabase.auth.updateUser(payload as never);
      if (error) return { error: error.message };
      void logAudit(currentActor(), {
        action: "PASSWORD_CHANGE",
        module: "Auth",
        description: "Password updated",
      });
      return {};
    },
    updateProfile: async (patch) => {
      if (!session?.user) return { error: "Not signed in" };
      const { error } = await supabase
        .from("profiles" as never)
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("id", session.user.id);
      if (error) return { error: error.message };
      void logAudit(currentActor(), {
        action: "PROFILE_UPDATE",
        module: "Users",
        entityType: "profile",
        entityId: session.user.id,
        newValues: patch,
        description: "Profile updated",
      });
      await loadIdentity(session.user);
      return {};
    },
    audit: (entry) => {
      void logAudit(currentActor(), entry);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Renders children only when the user holds the permission. */
export function PermissionGuard({
  permission,
  anyOf,
  fallback = null,
  children,
}: {
  permission?: string;
  anyOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, canAny } = useAuth();
  const ok = permission ? can(permission) : anyOf ? canAny(anyOf) : true;
  return <>{ok ? children : fallback}</>;
}
