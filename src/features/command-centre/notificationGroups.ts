/**
 * Recipient groups for report notifications.
 *
 * A group bundles many destinations (a Teams channel plus an email list, say)
 * behind one name, subscribes them to report events as a unit, and carries the
 * schedule that decides when they may be disturbed: timezone, delivery days,
 * a send window and quiet hours. The server-side fan-out honours the same
 * fields, so what is configured here is exactly what gates a delivery.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import type {
  NotificationChannel,
  NotificationEvent,
} from "@/features/command-centre/notificationEvents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export interface GroupMember {
  channel: NotificationChannel;
  destination: string;
  label?: string;
}

export interface NotificationGroup {
  id: string;
  name: string;
  description: string | null;
  members: GroupMember[];
  events: NotificationEvent[];
  active: boolean;
  timezone: string;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  window_days: number[];
  send_window_start: number;
  send_window_end: number;
  bypass_quiet_for_failures: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationGroupInput {
  name: string;
  description?: string | null;
  members: GroupMember[];
  events: NotificationEvent[];
  active: boolean;
  timezone: string;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  window_days: number[];
  send_window_start: number;
  send_window_end: number;
  bypass_quiet_for_failures: boolean;
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const GROUP_TIMEZONES = [
  "UTC",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Singapore",
];

export const EMPTY_GROUP: NotificationGroupInput = {
  name: "",
  description: "",
  members: [],
  events: ["report.completed", "report.failed"],
  active: true,
  timezone: "UTC",
  quiet_hours_start: 22,
  quiet_hours_end: 7,
  window_days: [1, 2, 3, 4, 5],
  send_window_start: 8,
  send_window_end: 20,
  bypass_quiet_for_failures: true,
};

const COLUMNS =
  "id,name,description,members,events,active,timezone,quiet_hours_start,quiet_hours_end,window_days,send_window_start,send_window_end,bypass_quiet_for_failures,created_at,updated_at";

export const notificationGroupsQuery = queryOptions({
  queryKey: ["notification-groups"],
  queryFn: async () => {
    const { data, error } = await table("notification_groups")
      .select(COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as NotificationGroup[];
  },
});

function requireTenant(): string {
  const companyId = getActiveTenant();
  if (!companyId) throw new Error("No active workspace.");
  return companyId;
}

export async function saveNotificationGroup(
  input: NotificationGroupInput,
  id?: string,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const row = {
    company_id: requireTenant(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    members: input.members,
    events: input.events,
    active: input.active,
    timezone: input.timezone,
    quiet_hours_start: input.quiet_hours_start,
    quiet_hours_end: input.quiet_hours_end,
    window_days: input.window_days,
    send_window_start: input.send_window_start,
    send_window_end: input.send_window_end,
    bypass_quiet_for_failures: input.bypass_quiet_for_failures,
  };
  const { error } = id
    ? await table("notification_groups").update(row).eq("id", id)
    : await table("notification_groups").insert({ ...row, created_by: auth.user?.id ?? null });
  if (error) throw new Error(error.message);
}

export async function deleteNotificationGroup(id: string): Promise<void> {
  const { error } = await table("notification_groups").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function toGroupInput(group: NotificationGroup): NotificationGroupInput {
  return {
    name: group.name,
    description: group.description ?? "",
    members: group.members ?? [],
    events: group.events ?? [],
    active: group.active,
    timezone: group.timezone ?? "UTC",
    quiet_hours_start: group.quiet_hours_start,
    quiet_hours_end: group.quiet_hours_end,
    window_days: group.window_days ?? [],
    send_window_start: group.send_window_start ?? 0,
    send_window_end: group.send_window_end ?? 24,
    bypass_quiet_for_failures: group.bypass_quiet_for_failures,
  };
}

/** Plain-language summary of when a group may be notified. */
export function describeSchedule(group: {
  timezone: string;
  window_days: number[];
  send_window_start: number;
  send_window_end: number;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
}): string {
  const days =
    (group.window_days ?? []).length === 7 || (group.window_days ?? []).length === 0
      ? "every day"
      : (group.window_days ?? [])
          .slice()
          .sort((a, b) => a - b)
          .map((d) => DAY_LABELS[d] ?? d)
          .join(", ");
  const quiet =
    group.quiet_hours_start !== null && group.quiet_hours_end !== null
      ? ` · quiet ${group.quiet_hours_start}:00–${group.quiet_hours_end}:00`
      : "";
  return `${days} ${group.send_window_start}:00–${group.send_window_end}:00 ${group.timezone}${quiet}`;
}

/** Mirrors the server gate so the UI can show whether a group is on duty now. */
export function isWithinWindow(
  group: Pick<
    NotificationGroup,
    | "timezone"
    | "window_days"
    | "send_window_start"
    | "send_window_end"
    | "quiet_hours_start"
    | "quiet_hours_end"
  >,
  now = new Date(),
): boolean {
  let day = now.getUTCDay();
  let hour = now.getUTCHours();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: group.timezone || "UTC",
      weekday: "short",
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    day = Math.max(0, DAY_LABELS.indexOf(weekday));
    hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  } catch {
    /* fall back to UTC */
  }
  const days = group.window_days ?? [];
  if (days.length > 0 && !days.includes(day)) return false;
  if (!(hour >= group.send_window_start && hour < group.send_window_end)) return false;
  const qs = group.quiet_hours_start;
  const qe = group.quiet_hours_end;
  if (qs !== null && qe !== null && qs !== qe) {
    const quiet = qs < qe ? hour >= qs && hour < qe : hour >= qs || hour < qe;
    if (quiet) return false;
  }
  return true;
}
