import { supabase } from "@/integrations/supabase/client";

export type AuditEntry = {
  action: string;
  module?: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  oldValues?: unknown;
  newValues?: unknown;
  success?: boolean;
  failureReason?: string;
};

function parseAgent(ua: string) {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : "Unknown";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown";
  const device = /Mobi|Android|iPhone/.test(ua) ? "Mobile" : /iPad|Tablet/.test(ua) ? "Tablet" : "Desktop";
  return { browser, os, device };
}

export type AuditActor = {
  id: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

/** Fire-and-forget audit trail write. Never throws into the calling flow. */
export async function logAudit(actor: AuditActor, entry: AuditEntry) {
  if (typeof window === "undefined") return;
  try {
    const ua = navigator.userAgent;
    const { browser, os, device } = parseAgent(ua);
    await supabase.from("audit_logs" as never).insert({
      user_id: actor.id,
      user_name: actor.name ?? null,
      user_email: actor.email ?? null,
      user_role: actor.role ?? null,
      action: entry.action,
      module: entry.module ?? null,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      description: entry.description ?? null,
      old_values: (entry.oldValues ?? null) as never,
      new_values: (entry.newValues ?? null) as never,
      request_url: window.location.href,
      user_agent: ua,
      device,
      browser,
      os,
      success: entry.success ?? true,
      failure_reason: entry.failureReason ?? null,
    } as never);
  } catch {
    /* auditing must never break the app */
  }
}
