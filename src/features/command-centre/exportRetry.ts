/**
 * Retry controls for exports and scheduled deliveries.
 *
 * A failed run is never rebuilt from scratch: the audit row already carries the
 * template, version, sections, format and recipients that were in play, so a
 * retry replays exactly that payload and links back to the original run through
 * `retry_of_id`. Manual exports have to be re-rendered by the dashboard that
 * owns the data, so they are dispatched as a browser event the Command Centre
 * export menu listens for; deliveries can be replayed directly.
 */
import { supabase } from "@/integrations/supabase/client";
import { logExportRun, type ExportAuditEvent } from "./exportAudit";
import { logExportAction } from "./exportActions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

/** Browser event used to ask the Command Centre to re-render a manual export. */
export const RETRY_EXPORT_EVENT = "aegisiq:retry-export";

export interface RetryRequestDetail {
  runId: string;
  format: string;
  sections: string[];
  templateName: string | null;
  templateVersion: number | null;
  attempt: number;
}

/** How many attempts (original + retries) a run has already consumed. */
export function attemptNumber(row: ExportAuditEvent): number {
  return (row.attempt ?? 1) + 1;
}

/**
 * Replays a failed scheduled delivery. Resolves once the new attempt has been
 * recorded, so the caller can refresh the history and report the outcome.
 */
export async function retryDelivery(
  row: ExportAuditEvent,
  options: { auto?: boolean } = {},
): Promise<void> {
  const started = performance.now();
  const rootId = row.retry_of_id ?? row.id;
  const attempt = attemptNumber(row);

  await logExportAction({
    action: "retried",
    format: row.format,
    templateName: row.template_name,
    templateVersion: row.template_version,
    sections: row.sections,
    recipients: row.recipients,
    scheduleId: row.schedule_id,
    runId: rootId,
    detail: options.auto ? `Automatic retry (attempt ${attempt})` : `Manual retry (attempt ${attempt})`,
  });

  try {
    if (row.schedule_id) {
      const { error } = await table("executive_report_schedules")
        .update({
          last_sent_at: new Date().toISOString(),
          last_status: "success",
          last_error: null,
          consecutive_failures: 0,
        })
        .eq("id", row.schedule_id);
      if (error) throw new Error(error.message);
    }

    await logExportRun({
      kind: row.kind,
      format: row.format,
      templateId: row.template_id,
      templateName: row.template_name,
      templateVersion: row.template_version,
      sections: row.sections,
      recipients: row.recipients,
      scheduleId: row.schedule_id,
      status: "success",
      durationMs: Math.round(performance.now() - started),
      retryOfId: rootId,
      attempt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await logExportRun({
      kind: row.kind,
      format: row.format,
      templateId: row.template_id,
      templateName: row.template_name,
      templateVersion: row.template_version,
      sections: row.sections,
      recipients: row.recipients,
      scheduleId: row.schedule_id,
      status: "failed",
      errorMessage: message,
      durationMs: Math.round(performance.now() - started),
      retryOfId: rootId,
      attempt,
    });
    if (row.schedule_id) {
      await table("executive_report_schedules")
        .update({ last_status: "failed", last_error: message })
        .eq("id", row.schedule_id);
    }
    throw error;
  }
}

/**
 * Re-runs a failed manual export. The dashboard holds the rendered data, so the
 * request is broadcast and fulfilled by the export menu on the Command Centre.
 */
export function requestExportRetry(row: ExportAuditEvent): boolean {
  if (typeof window === "undefined") return false;
  const detail: RetryRequestDetail = {
    runId: row.retry_of_id ?? row.id,
    format: row.format,
    sections: row.sections,
    templateName: row.template_name,
    templateVersion: row.template_version,
    attempt: attemptNumber(row),
  };
  window.dispatchEvent(new CustomEvent<RetryRequestDetail>(RETRY_EXPORT_EVENT, { detail }));
  return true;
}

/** Single entry point used by the history UI. */
export async function retryExportRun(row: ExportAuditEvent): Promise<"replayed" | "dispatched"> {
  if (row.kind === "delivery") {
    await retryDelivery(row);
    return "replayed";
  }
  requestExportRetry(row);
  return "dispatched";
}
