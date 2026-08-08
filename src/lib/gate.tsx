import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const KEY_UNLOCKED = "lepdo.unlocked";
const KEY_PASSWORD = "lepdo.password";
const DEFAULT_PASSWORD = "2026";

type GateValue = {
  ready: boolean;
  unlocked: boolean;
  unlock: (password: string) => boolean;
  lock: () => void;
  changePassword: (current: string, next: string) => boolean;
};

const GateContext = createContext<GateValue | null>(null);

function storedPassword() {
  if (typeof window === "undefined") return DEFAULT_PASSWORD;
  return localStorage.getItem(KEY_PASSWORD) ?? DEFAULT_PASSWORD;
}

export function GateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setUnlocked(localStorage.getItem(KEY_UNLOCKED) === "true");
    setReady(true);
  }, []);

  const value: GateValue = {
    ready,
    unlocked,
    unlock: (password) => {
      if (password.trim() !== storedPassword()) return false;
      localStorage.setItem(KEY_UNLOCKED, "true");
      setUnlocked(true);
      return true;
    },
    lock: () => {
      localStorage.removeItem(KEY_UNLOCKED);
      setUnlocked(false);
    },
    changePassword: (current, next) => {
      if (current.trim() !== storedPassword()) return false;
      localStorage.setItem(KEY_PASSWORD, next.trim());
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
