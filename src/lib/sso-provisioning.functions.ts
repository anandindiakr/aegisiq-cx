import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Applies the tenant's configured SSO claim mappings to the signed-in user.
 *
 * Identity-provider claims (SAML attributes / OIDC claims) arrive on the JWT
 * inside `user_metadata` / `app_metadata`. Admins configure
 * `sso_role_mappings` rows (claim key + value -> role, optional outlet); this
 * function matches them and grants exactly those roles, so access follows the
 * directory instead of manual assignment.
 *
 * Runs with service role only AFTER the bearer token is verified, because
 * `user_roles` is intentionally not writable by end users.
 */
export const syncSsoRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, outlet_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.company_id) return { applied: 0, roles: [] as string[] };

    const { data: mappings } = await supabase
      .from("sso_role_mappings")
      .select("claim_key, claim_value, role, outlet_id, priority, is_active, deleted_at")
      .eq("company_id", profile.company_id);

    const active = (mappings ?? []).filter((m) => m.is_active && !m.deleted_at);
    if (active.length === 0) return { applied: 0, roles: [] as string[] };

    // Flatten the identity claims into a lookup of key -> string values.
    const raw = claims as Record<string, unknown>;
    const sources: Record<string, unknown>[] = [raw];
    for (const key of ["user_metadata", "app_metadata"]) {
      const nested = raw[key];
      if (nested && typeof nested === "object") sources.push(nested as Record<string, unknown>);
    }
    const claimValues = new Map<string, string[]>();
    for (const source of sources) {
      for (const [key, value] of Object.entries(source)) {
        const values = Array.isArray(value) ? value : [value];
        const strings = values
          .filter((v) => typeof v === "string" || typeof v === "number")
          .map((v) => String(v).toLowerCase());
        if (strings.length === 0) continue;
        claimValues.set(key.toLowerCase(), [
          ...(claimValues.get(key.toLowerCase()) ?? []),
          ...strings,
        ]);
      }
    }

    const matched = active
      .filter((m) =>
        (claimValues.get(m.claim_key.toLowerCase()) ?? []).includes(m.claim_value.toLowerCase()),
      )
      .sort((a, b) => a.priority - b.priority);

    if (matched.length === 0) return { applied: 0, roles: [] as string[] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const roles = [...new Set(matched.map((m) => m.role))];

    await supabaseAdmin.from("user_roles").upsert(
      roles.map((role) => ({ user_id: userId, company_id: profile.company_id, role })),
      { onConflict: "user_id,role" },
    );

    // Remove roles this tenant's directory no longer grants.
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("company_id", profile.company_id)
      .not("role", "in", `(${roles.join(",")})`);

    const outletId = matched.find((m) => m.outlet_id)?.outlet_id ?? null;
    if (outletId && outletId !== profile.outlet_id) {
      await supabaseAdmin.from("profiles").update({ outlet_id: outletId }).eq("user_id", userId);
    }

    return { applied: matched.length, roles };
  });
