/**
 * Saved Command Centre filter presets.
 *
 * A preset is a named snapshot of the global filter model. Private presets are
 * only visible to their author; shared presets are visible to everybody in the
 * workspace so leadership teams can standardise on the same views.
 *
 * Presets can additionally be *scoped*: a role-group preset targets one or more
 * roles, an outlet preset targets a single outlet. Marking a scoped preset as
 * default makes it the view the matching people land on.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant, type AppRole } from "@/features/platform/queries";
import { defaultFilters, type CommandFilters } from "./filters";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export type PresetScope = "personal" | "role" | "outlet";

export const PRESET_SCOPES: { value: PresetScope; label: string; hint: string }[] = [
  { value: "personal", label: "Personal", hint: "Only relevant to you or anyone you share with" },
  { value: "role", label: "Role group", hint: "Targeted at one or more roles" },
  { value: "outlet", label: "Outlet", hint: "Targeted at a single outlet" },
];

export interface FilterPreset {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  filters: CommandFilters;
  is_shared: boolean;
  is_default: boolean;
  scope: PresetScope;
  scope_roles: AppRole[];
  outlet_id: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "id,user_id,name,description,filters,is_shared,is_default,scope,scope_roles,outlet_id,created_at,updated_at";

export const filterPresetsQuery = queryOptions({
  queryKey: ["command-filter-presets"],
  queryFn: async () => {
    const { data, error } = await table("command_filter_presets")
      .select(COLUMNS)
      .order("is_default", { ascending: false })
      .order("is_shared", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as FilterPreset[]).map(normalise);
  },
});

function normalise(preset: FilterPreset): FilterPreset {
  return {
    ...preset,
    scope: (preset.scope ?? "personal") as PresetScope,
    scope_roles: preset.scope_roles ?? [],
    is_default: preset.is_default ?? false,
  };
}

/** Merges a stored preset onto the current defaults so older presets stay valid. */
export function presetToFilters(preset: FilterPreset): CommandFilters {
  return { ...defaultFilters(), ...(preset.filters ?? {}) };
}

/** Plain-language description of who a preset applies to. */
export function scopeLabel(preset: FilterPreset, outletName?: string): string {
  if (preset.scope === "role") {
    return preset.scope_roles.length
      ? preset.scope_roles.map((r) => r.replace(/_/g, " ")).join(", ")
      : "All roles";
  }
  if (preset.scope === "outlet") return outletName ?? "Outlet preset";
  return preset.is_shared ? "Shared with workspace" : "Private";
}

/**
 * The preset a viewer should land on: the most specific default that matches
 * their outlet, then their roles, then any workspace-wide default.
 */
export function resolveDefaultPreset(
  presets: FilterPreset[],
  viewer: { roles: AppRole[]; outletId: string | null },
): FilterPreset | undefined {
  const defaults = presets.filter((p) => p.is_default);
  return (
    defaults.find((p) => p.scope === "outlet" && p.outlet_id && p.outlet_id === viewer.outletId) ??
    defaults.find(
      (p) => p.scope === "role" && p.scope_roles.some((r) => viewer.roles.includes(r)),
    ) ??
    defaults.find((p) => p.scope === "personal")
  );
}

export interface FilterPresetInput {
  name: string;
  description?: string | null;
  filters: CommandFilters;
  is_shared: boolean;
  is_default?: boolean;
  scope?: PresetScope;
  scope_roles?: AppRole[];
  outlet_id?: string | null;
}

export async function createFilterPreset(input: FilterPresetInput) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  const { error } = await table("command_filter_presets").insert({
    company_id: getActiveTenant(),
    user_id: auth.user.id,
    name: input.name,
    description: input.description ?? null,
    filters: input.filters as unknown as Record<string, unknown>,
    is_shared: input.is_shared,
    is_default: input.is_default ?? false,
    scope: input.scope ?? "personal",
    scope_roles: input.scope_roles ?? [],
    outlet_id: input.scope === "outlet" ? (input.outlet_id ?? null) : null,
  });
  if (error) throw new Error(error.message);
}

export async function updateFilterPreset(id: string, patch: Partial<FilterPresetInput>) {
  const { error } = await table("command_filter_presets").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Makes one preset the default for its scope, clearing the previous default of
 * the same scope so exactly one view wins per audience.
 */
export async function setDefaultPreset(preset: FilterPreset, siblings: FilterPreset[]) {
  const conflicting = siblings.filter(
    (p) =>
      p.id !== preset.id &&
      p.is_default &&
      p.scope === preset.scope &&
      (preset.scope !== "outlet" || p.outlet_id === preset.outlet_id),
  );
  for (const other of conflicting) {
    await updateFilterPreset(other.id, { is_default: false });
  }
  await updateFilterPreset(preset.id, { is_default: true });
}

export async function deleteFilterPreset(id: string) {
  const { error } = await table("command_filter_presets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Bulk actions                                                        */
/* ------------------------------------------------------------------ */

/** Copies presets, optionally re-pointing them at another scope/audience. */
export async function duplicateFilterPresets(
  presets: FilterPreset[],
  options: {
    suffix?: string;
    scope?: PresetScope;
    scope_roles?: AppRole[];
    outlet_ids?: string[];
    is_shared?: boolean;
  } = {},
): Promise<number> {
  const targets = options.scope === "outlet" && options.outlet_ids?.length
    ? options.outlet_ids
    : [null];
  let created = 0;
  for (const preset of presets) {
    for (const outletId of targets) {
      await createFilterPreset({
        name: `${preset.name}${options.suffix ?? " (copy)"}`,
        description: preset.description,
        filters: presetToFilters(preset),
        is_shared: options.is_shared ?? preset.is_shared,
        is_default: false,
        scope: options.scope ?? preset.scope,
        scope_roles: options.scope_roles ?? preset.scope_roles,
        outlet_id: outletId ?? preset.outlet_id,
      });
      created += 1;
    }
  }
  return created;
}

/**
 * Renames several presets at once using a pattern. `{name}` keeps the original
 * name and `{n}` inserts a 1-based index, so "Q3 — {name}" or "Board view {n}"
 * both work.
 */
export function applyRenamePattern(pattern: string, original: string, index: number): string {
  const applied = pattern.replace(/\{name\}/g, original).replace(/\{n\}/g, String(index + 1));
  return applied.trim() || original;
}

export async function bulkRenamePresets(presets: FilterPreset[], pattern: string): Promise<number> {
  let renamed = 0;
  for (const [index, preset] of presets.entries()) {
    const next = applyRenamePattern(pattern, preset.name, index);
    if (next === preset.name) continue;
    await updateFilterPreset(preset.id, { name: next });
    renamed += 1;
  }
  return renamed;
}

export async function bulkDeletePresets(presets: FilterPreset[]): Promise<number> {
  for (const preset of presets) {
    await deleteFilterPreset(preset.id);
  }
  return presets.length;
}

/** Re-targets presets at a different role group or outlet in one pass. */
export async function bulkRescopePresets(
  presets: FilterPreset[],
  scope: PresetScope,
  options: { scope_roles?: AppRole[]; outlet_id?: string | null } = {},
): Promise<number> {
  for (const preset of presets) {
    await updateFilterPreset(preset.id, {
      scope,
      scope_roles: scope === "role" ? (options.scope_roles ?? []) : [],
      outlet_id: scope === "outlet" ? (options.outlet_id ?? null) : null,
    });
  }
  return presets.length;
}

/** Shareable link that reproduces the preset for a colleague. */
export function presetShareUrl(preset: FilterPreset): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/command-centre?preset=${preset.id}`;
}
