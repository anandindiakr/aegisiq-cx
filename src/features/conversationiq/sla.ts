import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { reviewQueueQuery, slaMinutesLeft, slaState, formatSla } from "./queue";
import type { ReviewAssignment } from "./queue";
import { DEFAULT_PREFERENCES, notificationPreferencesQuery, slaCooldownMs } from "./notifications";

/**
 * SLA watch — polls the reviewer queue and raises an in-app notification when
 * an item breaches (or is about to breach) its service-level target. How often
 * a reviewer may be re-notified for the same item comes from their personal
 * notification settings, so nobody is nagged more than they asked for.
 */

const STORAGE_KEY = "aegisiq.sla.notified";
const POLL_MS = 60_000;

/** id -> { state, at } of the last notification we raised for that item. */
type NotifiedMap = Record<string, { state: string; at: number }>;

function readNotified(): NotifiedMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as NotifiedMap;
  } catch {
    return {};
  }
}

function writeNotified(value: NotifiedMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export interface SlaSnapshot {
  breached: ReviewAssignment[];
  dueSoon: ReviewAssignment[];
  active: ReviewAssignment[];
}

export function summariseSla(items: ReviewAssignment[]): SlaSnapshot {
  const active = items.filter((item) => item.status === "open" || item.status === "in_progress");
  return {
    active,
    breached: active.filter((item) => slaState(item) === "breached"),
    dueSoon: active.filter((item) => slaState(item) === "due_soon"),
  };
}

/**
 * Watches the queue in the background and toasts when items cross a
 * threshold. Mount once per page that should surface escalations.
 */
export function useSlaWatch(options: { enabled?: boolean } = {}) {
  const prefsQuery = useQuery(notificationPreferencesQuery);
  const prefs = prefsQuery.data ?? DEFAULT_PREFERENCES;
  const enabled = options.enabled ?? true;

  const queue = useQuery({
    ...reviewQueueQuery,
    refetchInterval: enabled ? POLL_MS : false,
    refetchIntervalInBackground: false,
  });
  const seen = useRef<NotifiedMap | null>(null);

  const items = queue.data;
  const notify = enabled && prefs.sla_in_app && prefs.sla_frequency !== "off";
  const cooldown = slaCooldownMs(prefs.sla_frequency);

  useEffect(() => {
    if (!notify || !items) return;
    if (seen.current === null) seen.current = readNotified();
    const snapshot = summariseSla(items);
    const next: NotifiedMap = { ...seen.current };
    const now = Date.now();
    let changed = false;

    const fresh = (id: string, state: string) => {
      const last = next[id];
      if (!last) return true;
      if (last.state !== state) return true;
      return now - last.at >= cooldown;
    };

    for (const item of snapshot.breached) {
      if (!fresh(item.id, "breached")) continue;
      next[item.id] = { state: "breached", at: now };
      changed = true;
      toast.error(`SLA breached — ${item.title}`, {
        description: `${formatSla(slaMinutesLeft(item))} · ${
          item.assignee_name ?? "Unassigned"
        } · ${item.priority} priority`,
        duration: 10_000,
      });
    }

    for (const item of snapshot.dueSoon) {
      if (!fresh(item.id, "due_soon")) continue;
      next[item.id] = { state: "due_soon", at: now };
      changed = true;
      toast.warning(`SLA due soon — ${item.title}`, {
        description: `${formatSla(slaMinutesLeft(item))} · ${item.assignee_name ?? "Unassigned"}`,
      });
    }

    if (changed) {
      seen.current = next;
      writeNotified(next);
    }
  }, [items, notify, cooldown]);

  return {
    ...summariseSla(items ?? []),
    isLoading: queue.isLoading,
    refetch: queue.refetch,
    preferences: prefs,
  };
}
