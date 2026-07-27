import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { captureError, setObservabilityContext } from "@/lib/observability";
import type { AppRole } from "./queries";

export interface TenantContext {
  userId: string;
  email: string | null;
  companyId: string;
  fullName: string;
  roles: AppRole[];
}

const ADMIN_ROLES: AppRole[] = ["super_admin", "tenant_admin"];

/**
 * Resolves the signed-in user's tenant membership.
 *
 * The database enforces isolation through row-level security (every tenant
 * table filters on `current_company_id()`), and this guard mirrors that at the
 * routing layer: without a profile row bound to a company there is no tenant to
 * scope to, so the session is signed out rather than shown an empty console.
 */
export async function loadTenantContext(): Promise<TenantContext> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw redirect({ to: "/" });

  const [{ data: profile, error: profileError }, { data: roleRows, error: rolesError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("company_id, full_name, email")
        .eq("user_id", auth.user.id)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
    ]);

  if (profileError || rolesError) {
    captureError(profileError ?? rolesError, { guard: "tenant", userId: auth.user.id });
    throw new Error("We couldn't verify your workspace membership. Please try again.");
  }

  if (!profile?.company_id) {
    // Authenticated but not attached to a tenant: deny rather than leak a shell.
    await supabase.auth.signOut();
    throw redirect({ to: "/" });
  }

  const roles = (roleRows ?? []).map((r) => r.role as AppRole);
  const tenant: TenantContext = {
    userId: auth.user.id,
    email: profile.email ?? auth.user.email ?? null,
    companyId: profile.company_id,
    fullName: profile.full_name,
    roles,
  };

  setObservabilityContext({
    userId: tenant.userId,
    email: tenant.email,
    companyId: tenant.companyId,
    roles: tenant.roles,
  });

  return tenant;
}

export function hasAnyRole(tenant: TenantContext | undefined, roles: AppRole[]) {
  return !!tenant && tenant.roles.some((role) => roles.includes(role));
}

export function isTenantAdmin(tenant: TenantContext | undefined) {
  return hasAnyRole(tenant, ADMIN_ROLES);
}

/** Role gate for administrative routes; bounces to the dashboard when denied. */
export function requireRoles(tenant: TenantContext | undefined, roles: AppRole[]) {
  if (!hasAnyRole(tenant, roles)) throw redirect({ to: "/dashboard" });
}
