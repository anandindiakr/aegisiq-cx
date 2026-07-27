import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant, type AppRole, type StaffProfile } from "@/features/platform/queries";

/**
 * Role administration for a company workspace.
 *
 * Row-level security is the enforcement point: only company admins may write
 * `user_roles`, admins cannot change their own grants (no self-escalation and
 * no accidental lock-out), and only a super admin can hand out `super_admin`.
 * This module is the matching client surface.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

export const ASSIGNABLE_ROLES: AppRole[] = [
  "tenant_admin",
  "regional_manager",
  "outlet_manager",
  "supervisor",
  "viewer",
];

export interface RoleGrant {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface CompanyMember {
  profile: StaffProfile;
  grants: RoleGrant[];
  roles: AppRole[];
}

export const roleGrantsQuery = queryOptions({
  queryKey: ["platform", "role-grants"],
  queryFn: () =>
    traced("platform.role_grants", async () => {
      const company = getActiveTenant();
      let builder = raw
        .from("user_roles")
        .select("id,user_id,role,created_at")
        .order("created_at", { ascending: true });
      if (company) builder = builder.eq("company_id", company);
      const { data, error } = await builder;
      if (error) throw new Error(error.message);
      return (data ?? []) as RoleGrant[];
    }),
});

/** Directory profiles merged with the roles actually granted in the database. */
export function mergeMembers(profiles: StaffProfile[], grants: RoleGrant[]): CompanyMember[] {
  const byUser = new Map<string, RoleGrant[]>();
  for (const grant of grants) {
    const list = byUser.get(grant.user_id) ?? [];
    list.push(grant);
    byUser.set(grant.user_id, list);
  }
  return profiles.map((profile) => {
    const list = profile.user_id ? (byUser.get(profile.user_id) ?? []) : [];
    return { profile, grants: list, roles: list.map((g) => g.role) };
  });
}

export async function grantRole(userId: string, role: AppRole) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const { error } = await raw
    .from("user_roles")
    .insert({ user_id: userId, company_id: company, role });
  if (error) {
    throw new Error(
      error.message.includes("duplicate")
        ? "That person already holds this role."
        : error.message.includes("row-level security")
          ? "You cannot grant this role. Admins cannot change their own roles, and only a super admin can grant super admin."
          : error.message,
    );
  }
}

export async function revokeRole(grantId: string) {
  const company = getActiveTenant();
  let query = raw.from("user_roles").delete().eq("id", grantId);
  if (company) query = query.eq("company_id", company);
  const { data, error } = await query.select("id");
  if (error) throw new Error(error.message);
  if (((data ?? []) as { id: string }[]).length === 0) {
    throw new Error("That role could not be revoked — you cannot change your own grants.");
  }
}

/** Keeps the directory row's display tier in step with the granted roles. */
export async function setDirectoryRole(profileId: string, role: AppRole) {
  const company = getActiveTenant();
  let query = raw.from("profiles").update({ directory_role: role }).eq("id", profileId);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}
