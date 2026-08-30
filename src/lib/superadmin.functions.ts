import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * Creates (or repairs) the Super Admin account using SUPER_ADMIN_PASSWORD
 * from the project environment. The caller must already know the env password —
 * it is never returned or leaked.
 */
export const bootstrapSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env["SUPER_ADMIN_PASSWORD"];
    const adminEmail = (process.env["SUPER_ADMIN_EMAIL"] ?? "lepdogroup@gmail.com").toLowerCase();

    if (!expected) return { ok: false as const, error: "Super Admin password is not configured." };
    if (data.email.trim().toLowerCase() !== adminEmail) {
      return { ok: false as const, error: "Not the Super Admin account." };
    }
    if (!data.password || !matches(data.password, expected)) {
      return { ok: false as const, error: "Incorrect password." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find the existing auth user (paginate defensively).
    let existingId: string | null = null;
    for (let page = 1; page <= 10 && !existingId; page += 1) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return { ok: false as const, error: error.message };
      const found = list.users.find((u) => (u.email ?? "").toLowerCase() === adminEmail);
      if (found) existingId = found.id;
      if (list.users.length < 200) break;
    }

    if (existingId) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
        password: expected,
        email_confirm: true,
      });
      if (error) return { ok: false as const, error: error.message };
    } else {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: expected,
        email_confirm: true,
      });
      if (error) return { ok: false as const, error: error.message };
    }

    return { ok: true as const };
  });
