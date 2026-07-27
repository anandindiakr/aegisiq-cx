import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant } from "@/features/platform/queries";

/**
 * Per-user notification settings — which channels a reviewer wants for alerts
 * and SLA escalations, and how often SLA reminders may repeat. Rows are
 * private to the owning user (row-level security scopes on `auth.uid()`).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

export type SlaFrequency = "immediate" | "hourly" | "daily" | "off";

export const SLA_FREQUENCIES: { value: SlaFrequency; label: string; hint: string }[] = [
  { value: "immediate", label: "Immediately", hint: "Notify the moment an item crosses its SLA" },
  { value: "hourly", label: "Hourly", hint: "At most one reminder per item per hour" },
  { value: "daily", label: "Daily", hint: "At most one reminder per item per day" },
  { value: "off", label: "Off", hint: "Never notify on SLA breaches" },
];

export interface NotificationPreferences {
  in_app_alerts: boolean;
  email_alerts: boolean;
  sla_in_app: boolean;
  sla_email: boolean;
  sla_frequency: SlaFrequency;
  digest_email: string | null;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  in_app_alerts: true,
  email_alerts: false,
  sla_in_app: true,
  sla_email: false,
  sla_frequency: "immediate",
  digest_email: null,
};

const COLUMNS = "in_app_alerts,email_alerts,sla_in_app,sla_email,sla_frequency,digest_email";

export const notificationPreferencesQuery = queryOptions({
  queryKey: ["iq", "notification-preferences"],
  queryFn: () =>
    traced("iq.notification_preferences", async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return DEFAULT_PREFERENCES;
      const { data, error } = await raw
        .from("notification_preferences")
        .select(COLUMNS)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { ...DEFAULT_PREFERENCES, ...(data ?? {}) } as NotificationPreferences;
    }),
});

/** Creates or updates the signed-in user's notification settings. */
export async function saveNotificationPreferences(patch: Partial<NotificationPreferences>) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("You are not signed in.");

  const { error } = await raw.from("notification_preferences").upsert(
    {
      user_id: auth.user.id,
      company_id: company,
      ...patch,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

/** Minimum minutes between repeat SLA notifications for the same item. */
export function slaCooldownMs(frequency: SlaFrequency) {
  switch (frequency) {
    case "hourly":
      return 60 * 60_000;
    case "daily":
      return 24 * 60 * 60_000;
    case "off":
      return Number.POSITIVE_INFINITY;
    default:
      return 0;
  }
}
