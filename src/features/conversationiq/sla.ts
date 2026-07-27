import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { reviewQueueQuery, slaMinutesLeft, slaState, formatSla } from "./queue";
import type { ReviewAssignment } from "./queue";
import { DEFAULT_PREFERENCES, notificationPreferencesQuery, slaCooldownMs } from "./notifications";
import {
  ESCALATION_ACTION_LABELS,
  dueEscalations,
  policyFor,
  slaPoliciesQuery,
  warningMinutes,
  type SlaPolicyWithSteps,
} from "./slaPolicies";

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

export function summariseSla(
  items: ReviewAssignment[],
  policies?: SlaPolicyWithSteps[],
): SlaSnapshot {
  const active = items.filter((item) => item.status === "open" || item.status === "in_progress");
  /** Due-soon uses the tenant's configured warning threshold when one exists. */
  const isDueSoon = (item: ReviewAssignment) => {
    const left = slaMinutesLeft(item);
    if (left < 0) return false;
    const policy = policyFor(policies, item.priority);
    if (!policy) return slaState(item) === "due_soon";
    return left <= warningMinutes(policy, item.sla_minutes);
  };
  return {
    active,
    breached: active.filter((item) => slaMinutesLeft(item) < 0),
    dueSoon: active.filter(isDueSoon),
  };
}

/**
 * Watches the queue in the background and toasts when items cross a
 * threshold. Mount once per page that should surface escalations.
 */
export function useSlaWatch(options: { enabled?: boolean } = {}) {
  const prefsQuery = useQuery(notificationPreferencesQuery);
  const prefs = prefsQuery.data ?? DEFAULT_PREFERENCES;
  const policiesQuery = useQuery(slaPoliciesQuery);
  const policies = policiesQuery.data;
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
    const snapshot = summariseSla(items, policies);
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
      const steps = dueEscalations(item, policyFor(policies, item.priority), now);
      const reached = steps.at(-1);
      const state = reached ? `breached:${reached.id}` : "breached";
      if (!fresh(item.id, state)) continue;
      next[item.id] = { state, at: now };
      changed = true;
      const escalation = reached
        ? ` · escalation ${reached.step_order}: ${ESCALATION_ACTION_LABELS[reached.action]}${
            reached.notify_role ? ` ${reached.notify_role.replace(/_/g, " ")}` : ""
          }`
        : "";
      toast.error(`SLA breached — ${item.title}`, {
        description: `${formatSla(slaMinutesLeft(item))} · ${
          item.assignee_name ?? "Unassigned"
        } · ${item.priority} priority${escalation}`,
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
  }, [items, notify, cooldown, policies]);

  return {
    ...summariseSla(items ?? [], policies),
    isLoading: queue.isLoading,
    refetch: queue.refetch,
    preferences: prefs,
  };
}
