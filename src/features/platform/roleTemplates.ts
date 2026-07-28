import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant, type AppRole } from "@/features/platform/queries";
import type { IqCapability } from "@/features/conversationiq/access";

/**
 * Role templates — a named, reusable permission matrix.
 *
 * A template captures two things: the bundle of roles it grants to a person,
 * and the capability matrix (capability -> roles) the workspace should run on.
 * Templates marked `is_shared` are visible to every workspace, so a matrix
 * agreed once can be adopted by another company without rebuilding it
 * permission by permission. Row-level security keeps writes admin-only and
 * scoped to the owning workspace.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

export type CapabilityMatrix = Partial<Record<IqCapability, AppRole[]>>;

export interface RoleTemplate {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  roles: AppRole[];
  capabilities: CapabilityMatrix;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

const COLUMNS = "id,company_id,name,description,roles,capabilities,is_shared,created_at,updated_at";

export const roleTemplatesQuery = queryOptions({
  queryKey: ["platform", "role-templates"],
  queryFn: () =>
    traced("platform.role_templates", async () => {
      const { data, error } = await raw
        .from("role_templates")
        .select(COLUMNS)
        .order("is_shared", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as RoleTemplate[];
    }),
});

export interface TemplateInput {
  name: string;
  description?: string | null;
  roles: AppRole[];
  capabilities: CapabilityMatrix;
  isShared: boolean;
}

export async function createTemplate(input: TemplateInput) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await raw
    .from("role_templates")
    .insert({
      company_id: company,
      name: input.name.trim().slice(0, 120) || "Untitled template",
      description: input.description?.trim() || null,
      roles: input.roles,
      capabilities: input.capabilities,
      is_shared: input.isShared,
      created_by: auth.user?.id ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string } | null)?.id ?? null;
}

export async function updateTemplate(id: string, patch: Partial<TemplateInput>) {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name.trim().slice(0, 120);
  if (patch.description !== undefined) body.description = patch.description?.trim() || null;
  if (patch.roles !== undefined) body.roles = patch.roles;
  if (patch.capabilities !== undefined) body.capabilities = patch.capabilities;
  if (patch.isShared !== undefined) body.is_shared = patch.isShared;
  const { error } = await raw.from("role_templates").update(body).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTemplate(id: string) {
  const { error } = await raw.from("role_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Copies a template (typically a shared one, or one adopted from another
 * workspace) into this workspace so it can be edited locally.
 */
export async function cloneTemplate(template: RoleTemplate, name?: string) {
  return createTemplate({
    name: name ?? `${template.name} (copy)`,
    description: template.description,
    roles: template.roles,
    capabilities: template.capabilities,
    isShared: false,
  });
}

/** Activates a template as the workspace's permission matrix (null clears it). */
export async function setActiveTemplate(templateId: string | null) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const { error } = await raw
    .from("companies")
    .update({ active_role_template_id: templateId })
    .eq("id", company);
  if (error) throw new Error(error.message);
}

/**
 * The workspace's active capability matrix, or `undefined` when no template is
 * applied (the built-in defaults then stand).
 */
export const activeCapabilityMatrixQuery = queryOptions({
  queryKey: ["platform", "active-capability-matrix"],
  queryFn: () =>
    traced("platform.active_matrix", async () => {
      const { data: company, error } = await raw
        .from("companies")
        .select("active_role_template_id")
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const id = (company as { active_role_template_id: string | null } | null)
        ?.active_role_template_id;
      if (!id) return null;
      const { data, error: templateError } = await raw
        .from("role_templates")
        .select(COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (templateError) throw new Error(templateError.message);
      return (data ?? null) as RoleTemplate | null;
    }),
});

/**
 * Applies a template's role bundle to a set of people: grants everything the
 * template lists and removes grants it does not, in one pass per member.
 */
export async function applyTemplateToMembers(
  template: RoleTemplate,
  members: { userId: string; currentGrants: { id: string; role: AppRole }[] }[],
) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const wanted: AppRole[] = template.roles.filter((role) => role !== "super_admin");
  let granted = 0;
  let revoked = 0;
  const failures: string[] = [];

  for (const member of members) {
    const held = new Set(member.currentGrants.map((g) => g.role));
    for (const role of wanted) {
      if (held.has(role)) continue;
      const { error } = await raw
        .from("user_roles")
        .insert({ user_id: member.userId, company_id: company, role });
      if (error) failures.push(error.message);
      else granted += 1;
    }
    for (const grant of member.currentGrants) {
      if (wanted.includes(grant.role) || grant.role === "super_admin") continue;
      const { error } = await raw.from("user_roles").delete().eq("id", grant.id);
      if (error) failures.push(error.message);
      else revoked += 1;
    }
  }

  return { granted, revoked, failures };
}
