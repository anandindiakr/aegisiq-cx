import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { reviewQueueQuery, slaMinutesLeft, slaState, formatSla } from "./queue";
import type { ReviewAssignment } from "./queue";

/**
 * SLA watch — polls the reviewer queue and raises an in-app notification the
 * first time an item breaches (or is about to breach) its service-level
 * target. Notified item IDs are remembered per browser session so a reviewer
 * is never nagged twice for the same escalation.
 */

const STORAGE_KEY = "aegisiq.sla.notified";
const EMAIL_PREF_KEY = "aegisiq.sla.email";
const POLL_MS = 60_000;

function readNotified(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writeNotified(value: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

/** Whether the reviewer opted in to email escalations for SLA breaches. */
export function emailEscalationEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(EMAIL_PREF_KEY) === "on";
}

export function setEmailEscalation(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EMAIL_PREF_KEY, enabled ? "on" : "off");
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
  const enabled = options.enabled ?? true;
  const queue = useQuery({
    ...reviewQueueQuery,
    refetchInterval: enabled ? POLL_MS : false,
    refetchIntervalInBackground: false,
  });
  const seen = useRef<Record<string, string> | null>(null);

  const items = queue.data;

  useEffect(() => {
    if (!enabled || !items) return;
    if (seen.current === null) seen.current = readNotified();
    const snapshot = summariseSla(items);
    const next = { ...seen.current };
    let changed = false;

    for (const item of snapshot.breached) {
      if (next[item.id] === "breached") continue;
      next[item.id] = "breached";
      changed = true;
      toast.error(`SLA breached — ${item.title}`, {
        description: `${formatSla(slaMinutesLeft(item))} · ${
          item.assignee_name ?? "Unassigned"
        } · ${item.priority} priority`,
        duration: 10_000,
      });
    }

    for (const item of snapshot.dueSoon) {
      if (next[item.id]) continue;
      next[item.id] = "due_soon";
      changed = true;
      toast.warning(`SLA due soon — ${item.title}`, {
        description: `${formatSla(slaMinutesLeft(item))} · ${item.assignee_name ?? "Unassigned"}`,
      });
    }

    if (changed) {
      seen.current = next;
      writeNotified(next);
    }
  }, [items, enabled]);

  return {
    ...summariseSla(items ?? []),
    isLoading: queue.isLoading,
    refetch: queue.refetch,
  };
}
