/**
 * Export *action* trail.
 *
 * `export_audit_events` records the outcome of a generated file. This trail is
 * one level wider: it captures every human action around an export — who
 * previewed it, who ran it, who scheduled or delivered it, who retried a failed
 * run and who asked for access to a restricted widget feeding it — with a
 * timestamp and an outcome for each.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import { captureError } from "@/lib/observability";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export type ExportAction =
  | "previewed"
  | "ran"
  | "scheduled"
  | "schedule_updated"
  | "delivered"
  | "retried"
  | "access_requested"
  | "access_decided";

export type ActionOutcome = "ok" | "failed" | "cancelled";

export const ACTION_LABELS: Record<ExportAction, string> = {
  previewed: "Previewed",
  ran: "Ran export",
  scheduled: "Created schedule",
  schedule_updated: "Updated schedule",
  delivered: "Delivered report",
  retried: "Retried",
  access_requested: "Requested widget access",
  access_decided: "Decided widget access",
};

export interface ExportActionEvent {
  id: string;
  actor_name: string | null;
  action: ExportAction;
  surface: string;
  format: string | null;
  template_name: string | null;
  template_version: number | null;
  sections: string[];
  recipients: string[];
  schedule_id: string | null;
  run_id: string | null;
  widget_id: string | null;
  outcome: ActionOutcome;
  detail: string | null;
  created_at: string;
}

const COLUMNS =
  "id,actor_name,action,surface,format,template_name,template_version,sections,recipients,schedule_id,run_id,widget_id,outcome,detail,created_at";

export interface ExportActionInput {
  action: ExportAction;
  surface?: string;
  format?: string | null;
  templateName?: string | null;
  templateVersion?: number | null;
  sections?: string[];
  recipients?: string[];
  scheduleId?: string | null;
  runId?: string | null;
  widgetId?: string | null;
  outcome?: ActionOutcome;
  detail?: string | null;
}

/** Logging an action must never break the action it describes. */
export async function logExportAction(input: ExportActionInput): Promise<void> {
  try {
    const companyId = getActiveTenant();
    if (!companyId) return;
    const { data: auth } = await supabase.auth.getUser();
    let name = auth.user?.email ?? null;
    if (auth.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      name = profile?.full_name ?? name;
    }
    await table("export_action_events").insert({
      company_id: companyId,
      actor_id: auth.user?.id ?? null,
      actor_name: name,
      action: input.action,
      surface: input.surface ?? "command-centre",
      format: input.format ?? null,
      template_name: input.templateName ?? null,
      template_version: input.templateVersion ?? null,
      sections: input.sections ?? [],
      recipients: input.recipients ?? [],
      schedule_id: input.scheduleId ?? null,
      run_id: input.runId ?? null,
      widget_id: input.widgetId ?? null,
      outcome: input.outcome ?? "ok",
      detail: input.detail ?? null,
    });
  } catch (error) {
    captureError(error, { area: "export-action-trail" });
  }
}

export const exportActionsQuery = queryOptions({
  queryKey: ["export-action-events"],
  queryFn: async () => {
    const { data, error } = await table("export_action_events")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(250);
    if (error) throw new Error(error.message);
    return (data ?? []) as ExportActionEvent[];
  },
});

export function exportActionsCsv(rows: ExportActionEvent[]): string {
  const head = [
    "Timestamp",
    "Actor",
    "Action",
    "Surface",
    "Format",
    "Template",
    "Template version",
    "Sections",
    "Recipients",
    "Widget",
    "Outcome",
    "Detail",
  ];
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    head.join(","),
    ...rows.map((row) =>
      [
        new Date(row.created_at).toISOString(),
        row.actor_name ?? "System",
        ACTION_LABELS[row.action] ?? row.action,
        row.surface,
        row.format ?? "",
        row.template_name ?? "",
        row.template_version ?? "",
        row.sections.join(" | "),
        row.recipients.join(" | "),
        row.widget_id ?? "",
        row.outcome,
        row.detail ?? "",
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\n");
}
