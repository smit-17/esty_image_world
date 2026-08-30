/**
 * Compatibility layer over the Supabase-backed auth system.
 * The old shared-password gate has been replaced by real user accounts,
 * roles and permissions (see src/lib/auth.tsx).
 */
import { isRouteAllowed as routeAllowed, useAuth } from "@/lib/auth";

export { PermissionGuard, isRouteAllowed, homePathFor } from "@/lib/auth";

export function useGate() {
  const auth = useAuth();
  return {
    ready: auth.ready,
    unlocked: auth.isAuthenticated && auth.isActive,
    role: auth.roles[0]?.code ?? null,
    isAdmin: auth.isAdmin,
    isSuperAdmin: auth.isSuperAdmin,
    homePath: auth.homePath,
    can: auth.can,
    lock: () => {
      void auth.signOut();
    },
    isAllowed: (pathname: string) => routeAllowed(pathname, auth.can),
  };
}
