/**
 * Completion notifications for exports and scheduled report deliveries.
 *
 * Every export run and delivery is already written to `export_audit_events`.
 * This hook watches that trail and raises a success or failure notification for
 * each new run — including runs started by a colleague or by a schedule — so an
 * executive always learns when an output completed or errored.
 */
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { exportAuditQuery, type ExportAuditEvent } from "./exportAudit";

const POLL_MS = 30_000;

function describe(event: ExportAuditEvent): string {
  const parts = [event.format.toUpperCase()];
  if (event.template_name) {
    parts.push(
      event.template_version
        ? `${event.template_name} v${event.template_version}`
        : event.template_name,
    );
  }
  if (event.recipients.length) {
    parts.push(`${event.recipients.length} recipient${event.recipients.length === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

export interface ExportNotificationsState {
  /** Runs that failed in this session, newest first. */
  failures: ExportAuditEvent[];
  pendingCount: number;
}

export function useExportNotifications(enabled = true): ExportNotificationsState {
  const query = useQuery({
    ...exportAuditQuery,
    enabled,
    refetchInterval: enabled ? POLL_MS : false,
  });

  const seen = useRef<Set<string> | null>(null);
  const rows = query.data;

  useEffect(() => {
    if (!rows) return;
    // The first load is the existing history: remember it silently so we only
    // ever notify about runs that complete while the user is watching.
    if (seen.current === null) {
      seen.current = new Set(rows.map((r) => r.id));
      return;
    }
    const fresh = rows.filter((r) => !seen.current!.has(r.id));
    for (const event of fresh.slice().reverse()) {
      seen.current.add(event.id);
      const noun = event.kind === "delivery" ? "Report delivery" : "Export";
      if (event.status === "success") {
        toast.success(`${noun} completed`, { description: describe(event) });
      } else {
        toast.error(`${noun} failed`, {
          description: `${describe(event)} — ${event.error_message ?? "Unknown error"}`,
          duration: 10_000,
        });
      }
    }
  }, [rows]);

  return {
    failures: (rows ?? []).filter((r) => r.status === "failed"),
    pendingCount: 0,
  };
}
