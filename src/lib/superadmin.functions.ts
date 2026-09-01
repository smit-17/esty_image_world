import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/**
 * Super Admin only — creates an internal account with a chosen username,
 * password, role and status. Email is optional; when blank a stable internal
 * address is derived from the username.
 */
export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      fullName: string;
      username: string;
      email?: string | null;
      password: string;
      roleId?: string | null;
      status: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin" as never, {
      _uid: context.userId,
    } as never);
    if (!isSuper) return { ok: false as const, error: "Only Super Admin can create users." };

    const username = data.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return { ok: false as const, error: "Username must be 3-32 chars (letters, numbers, . _ -)." };
    }
    if (!data.password || data.password.length < 6) {
      return { ok: false as const, error: "Password must be at least 6 characters." };
    }

    const email = (data.email?.trim() || `${username}@lepdo.local`).toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName.trim(), username },
    });
    if (error || !created.user) {
      return { ok: false as const, error: error?.message ?? "Could not create the account." };
    }

    const uid = created.user.id;
    const { error: profileError } = await supabaseAdmin.from("profiles" as never).upsert(
      {
        id: uid,
        email,
        username,
        full_name: data.fullName.trim() || username,
        status: data.status,
      } as never,
      { onConflict: "id" } as never,
    );
    if (profileError) return { ok: false as const, error: profileError.message };

    if (data.roleId) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles" as never)
        .insert({ user_id: uid, role_id: data.roleId, assigned_by: context.userId } as never);
      if (roleError) return { ok: false as const, error: roleError.message };
    }

    return { ok: true as const, userId: uid, email, username };
  });
