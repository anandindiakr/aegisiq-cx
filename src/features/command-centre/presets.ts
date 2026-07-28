/**
 * Saved Command Centre filter presets.
 *
 * A preset is a named snapshot of the global filter model. Private presets are
 * only visible to their author; shared presets are visible to everybody in the
 * workspace so leadership teams can standardise on the same views.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import { defaultFilters, type CommandFilters } from "./filters";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export interface FilterPreset {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  filters: CommandFilters;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export const filterPresetsQuery = queryOptions({
  queryKey: ["command-filter-presets"],
  queryFn: async () => {
    const { data, error } = await table("command_filter_presets")
      .select("id,user_id,name,description,filters,is_shared,created_at,updated_at")
      .order("is_shared", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as FilterPreset[];
  },
});

/** Merges a stored preset onto the current defaults so older presets stay valid. */
export function presetToFilters(preset: FilterPreset): CommandFilters {
  return { ...defaultFilters(), ...(preset.filters ?? {}) };
}

export async function createFilterPreset(input: {
  name: string;
  description?: string | null;
  filters: CommandFilters;
  is_shared: boolean;
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  const { error } = await table("command_filter_presets").insert({
    company_id: getActiveTenant(),
    user_id: auth.user.id,
    name: input.name,
    description: input.description ?? null,
    filters: input.filters as unknown as Record<string, unknown>,
    is_shared: input.is_shared,
  });
  if (error) throw new Error(error.message);
}

export async function updateFilterPreset(
  id: string,
  patch: { name?: string; filters?: CommandFilters; is_shared?: boolean },
) {
  const { error } = await table("command_filter_presets").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteFilterPreset(id: string) {
  const { error } = await table("command_filter_presets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Shareable link that reproduces the preset for a colleague. */
export function presetShareUrl(preset: FilterPreset): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/command-centre?preset=${preset.id}`;
}
