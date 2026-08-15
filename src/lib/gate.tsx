import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const KEY_ROLE = "lepdo.role";
const KEY_UNLOCKED = "lepdo.unlocked";
const KEY_PASSWORD = "lepdo.password";
const DEFAULT_ADMIN_PASSWORD = "901902";
const EXPERT_PASSWORD = "1212";

export type Role = "admin" | "expert";

/** Routes an expert (estimation-only) account may open. */
export const EXPERT_ROUTES = ["/estimates"] as const;

export function isRouteAllowed(role: Role | null, pathname: string) {
  if (role === "admin") return true;
  if (role === "expert") return EXPERT_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  return false;
}

type GateValue = {
  ready: boolean;
  unlocked: boolean;
  role: Role | null;
  isAdmin: boolean;
  isExpert: boolean;
  homePath: "/dashboard" | "/estimates";
  unlock: (password: string) => Role | null;
  lock: () => void;
  changePassword: (current: string, next: string) => boolean;
};

const GateContext = createContext<GateValue | null>(null);

function storedAdminPassword() {
  if (typeof window === "undefined") return DEFAULT_ADMIN_PASSWORD;
  return localStorage.getItem(KEY_PASSWORD) ?? DEFAULT_ADMIN_PASSWORD;
}

function clearSession() {
  localStorage.removeItem(KEY_UNLOCKED);
  localStorage.removeItem(KEY_ROLE);
  sessionStorage.removeItem(KEY_ROLE);
}

export function GateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(KEY_ROLE);
    if (localStorage.getItem(KEY_UNLOCKED) === "true" && (stored === "admin" || stored === "expert")) {
      setRole(stored);
    } else {
      clearSession();
    }
    setReady(true);
  }, []);

  const value: GateValue = {
    ready,
    unlocked: role !== null,
    role,
    isAdmin: role === "admin",
    isExpert: role === "expert",
    homePath: role === "expert" ? "/estimates" : "/dashboard",
    unlock: (password) => {
      const input = password.trim();
      let next: Role | null = null;
      if (input === EXPERT_PASSWORD) next = "expert";
      else if (input === storedAdminPassword()) next = "admin";
      if (!next) return null;
      localStorage.setItem(KEY_UNLOCKED, "true");
      localStorage.setItem(KEY_ROLE, next);
      setRole(next);
      return next;
    },
    lock: () => {
      clearSession();
      setRole(null);
    },
    changePassword: (current, next) => {
      if (role !== "admin") return false;
      if (current.trim() !== storedAdminPassword()) return false;
      const value = next.trim();
      if (!value || value === EXPERT_PASSWORD) return false;
      localStorage.setItem(KEY_PASSWORD, value);
      return true;
    },
  };

  return <GateContext.Provider value={value}>{children}</GateContext.Provider>;
}

export function useGate() {
  const ctx = useContext(GateContext);
  if (!ctx) throw new Error("useGate must be used inside GateProvider");
  return ctx;
}

/** Read the active role outside React (guards in data helpers). */
export function currentRole(): Role | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(KEY_UNLOCKED) !== "true") return null;
  const stored = localStorage.getItem(KEY_ROLE);
  return stored === "admin" || stored === "expert" ? stored : null;
}
