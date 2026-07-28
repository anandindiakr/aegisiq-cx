/**
 * Escalation notifications.
 *
 * When the database hands an overdue alert to its backup owner it writes an
 * `alert_escalations` row. This hook watches that trail and, for every new
 * hand-off, raises an in-app toast and fans the same event out to the tenant's
 * configured email / Slack / Teams / webhook recipients — carrying the reason
 * and the target timeout that was missed.
 *
 * Escalation ids are the dedupe key, so several executives watching the same
 * estate never cause duplicate emails or webhook posts.
 */
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { notify } from "@/features/command-centre/notificationChannels";
import { titleCase } from "@/lib/format";

import { recentEscalationsQuery, describeMinutes, type AlertEscalation } from "./sla";

const POLL_MS = 60_000;
const STORAGE_KEY = "aegisiq.alerts.escalations.notified";

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-300)));
}

export function escalationTarget(event: AlertEscalation): string {
  return event.to_user_name ?? (event.to_role ? titleCase(event.to_role) : "the backup owner");
}

export function escalationSummary(event: AlertEscalation): string {
  return `${event.reason}. Handed to ${escalationTarget(event)} after missing its target by ${describeMinutes(
    event.minutes_overdue,
  )}.`;
}

/** Mount on any alert surface that should surface automatic escalations. */
export function useEscalationNotifications(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const query = useQuery({
    ...recentEscalationsQuery,
    enabled,
    refetchInterval: enabled ? POLL_MS : false,
    refetchIntervalInBackground: false,
  });

  const seen = useRef<Set<string> | null>(null);
  const rows = query.data;

  useEffect(() => {
    if (!enabled || !rows) return;
    if (seen.current === null) {
      const stored = readSeen();
      seen.current = new Set(stored);
      // First load is history: remember it silently so we only announce
      // escalations that happen from now on (across reloads too).
      const merged = new Set([...stored, ...rows.map((r) => r.id)]);
      seen.current = merged;
      writeSeen([...merged]);
      return;
    }

    const fresh = rows.filter((row) => !seen.current!.has(row.id));
    if (fresh.length === 0) return;

    for (const event of fresh.slice().reverse()) {
      seen.current.add(event.id);
      const target = escalationTarget(event);
      toast.error(`Alert escalated to ${target}`, {
        description: `Level ${event.level} · ${escalationSummary(event)}`,
        duration: 12_000,
      });
      void notify(
        "alert.escalated",
        `Alert escalated to ${target}`,
        escalationSummary(event),
        {
          alertId: event.alert_id,
          escalationId: event.id,
          level: event.level,
          reason: event.reason,
          target,
          targetRole: event.to_role,
          minutesOverdue: event.minutes_overdue,
          escalatedAt: event.created_at,
        },
        { dedupeKey: `alert.escalated:${event.id}` },
      );
    }
    writeSeen([...seen.current]);
  }, [rows, enabled]);

  return {
    escalations: rows ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
