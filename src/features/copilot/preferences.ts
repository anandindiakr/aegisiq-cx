/**
 * Aegis Copilot™ personalisation.
 *
 * Preferences are stored per user *and* per tenant in `copilot_preferences`
 * (row-level security scopes every read to the signed-in user). They rank the
 * command library, seed default filters and remember recent searches.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant } from "@/features/platform/queries";
import type { CommandFilters } from "@/features/command-centre/filters";
import type { CopilotCommandCard } from "./catalog";

// The generated database types lag behind new migrations; a narrow cast keeps
// the service layer typed at its own boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export interface CopilotPreferences {
  id: string;
  company_id: string;
  user_id: string;
  favorite_outlet_id: string | null;
  favorite_reports: string[];
  pinned_dashboards: string[];
  recent_searches: string[];
  favorite_commands: string[];
  default_language: string;
  voice_enabled: boolean;
  speech_rate: number;
}

export const EMPTY_PREFERENCES: Omit<CopilotPreferences, "id" | "company_id" | "user_id"> = {
  favorite_outlet_id: null,
  favorite_reports: [],
  pinned_dashboards: [],
  recent_searches: [],
  favorite_commands: [],
  default_language: "en-GB",
  voice_enabled: true,
  speech_rate: 1,
};

export const copilotPreferencesQuery = queryOptions({
  queryKey: ["copilot", "preferences"],
  queryFn: () =>
    traced("copilot.preferences", async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return null;
      const { data, error } = await table("copilot_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as CopilotPreferences | null;
    }),
  staleTime: 60_000,
});

/** Upserts the signed-in user's copilot preferences for the active tenant. */
export async function saveCopilotPreferences(
  patch: Partial<Omit<CopilotPreferences, "id" | "company_id" | "user_id">>,
) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("You must be signed in to save copilot preferences.");
  const companyId = getActiveTenant();

  const row: Record<string, unknown> = { user_id: userId, ...patch };
  if (companyId) row.company_id = companyId;

  const { error } = await table("copilot_preferences").upsert(row, {
    onConflict: "company_id,user_id",
  });
  if (error) throw new Error(error.message);
}

export const MAX_RECENT_SEARCHES = 12;

/** Appends a phrase to the rolling recent-search list (most recent first). */
export async function recordRecentSearch(
  phrase: string,
  current: CopilotPreferences | null | undefined,
) {
  const trimmed = phrase.trim();
  if (!trimmed) return;
  const existing = current?.recent_searches ?? [];
  if (existing[0]?.toLowerCase() === trimmed.toLowerCase()) return;
  const next = [
    trimmed,
    ...existing.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX_RECENT_SEARCHES);
  await saveCopilotPreferences({ recent_searches: next });
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export async function toggleFavoriteReport(
  reportId: string,
  current: CopilotPreferences | null | undefined,
) {
  await saveCopilotPreferences({
    favorite_reports: toggle(current?.favorite_reports ?? [], reportId),
  });
}

export async function togglePinnedDashboard(
  dashboardKey: string,
  current: CopilotPreferences | null | undefined,
) {
  await saveCopilotPreferences({
    pinned_dashboards: toggle(current?.pinned_dashboards ?? [], dashboardKey),
  });
}

export async function toggleFavoriteCommand(
  commandId: string,
  current: CopilotPreferences | null | undefined,
) {
  await saveCopilotPreferences({
    favorite_commands: toggle(current?.favorite_commands ?? [], commandId),
  });
}

/**
 * Ranks command cards: pinned dashboards and favourite commands first, then
 * anything matching a recent search, then catalogue order.
 */
export function rankCommands(
  cards: CopilotCommandCard[],
  prefs: CopilotPreferences | null | undefined,
): CopilotCommandCard[] {
  if (!prefs) return cards;
  const favourites = new Set(prefs.favorite_commands ?? []);
  const recent = (prefs.recent_searches ?? []).map((s) => s.toLowerCase());
  const score = (card: CopilotCommandCard) => {
    if (favourites.has(card.id)) return 0;
    if (recent.some((s) => s.includes(card.label.toLowerCase()))) return 1;
    if ((prefs.pinned_dashboards ?? []).some((key) => card.id.includes(key))) return 2;
    return 3;
  };
  return [...cards].sort((a, b) => score(a) - score(b));
}

/** Applies the user's favourite outlet as a default command-centre filter. */
export function withPreferenceDefaults(
  filters: CommandFilters,
  prefs: CopilotPreferences | null | undefined,
): CommandFilters {
  if (!prefs?.favorite_outlet_id) return filters;
  if (filters.outlets.length > 0) return filters;
  return { ...filters, outlets: [prefs.favorite_outlet_id] };
}
