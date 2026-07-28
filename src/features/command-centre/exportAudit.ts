/**
 * Export and delivery audit.
 *
 * Every board-report export run and every scheduled report delivery is written
 * to an append-only table with the output format, the template and template
 * version used, the recipients and the success/failure outcome, so compliance
 * can reconstruct exactly what data left the platform and when.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import { captureError } from "@/lib/observability";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export type ExportRunKind = "export" | "delivery";
export type ExportRunStatus = "success" | "failed";

export interface ExportAuditEvent {
  id: string;
  actor_name: string | null;
  kind: ExportRunKind;
  format: string;
  template_id: string | null;
  template_name: string | null;
  template_version: number | null;
  sections: string[];
  recipients: string[];
  schedule_id: string | null;
  status: ExportRunStatus;
  error_message: string | null;
  duration_ms: number | null;
  retry_of_id: string | null;
  attempt: number;
  auto_retry: boolean;
  created_at: string;
}

export interface ExportRunInput {
  kind: ExportRunKind;
  format: string;
  templateId?: string | null;
  templateName?: string | null;
  templateVersion?: number | null;
  sections?: string[];
  recipients?: string[];
  scheduleId?: string | null;
  status: ExportRunStatus;
  errorMessage?: string | null;
  durationMs?: number | null;
  filters?: Record<string, unknown>;
  retryOfId?: string | null;
  attempt?: number;
  autoRetry?: boolean;
}

async function actorName(userId: string | undefined, email: string | null): Promise<string | null> {
  if (!userId) return email;
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.full_name ?? email;
}

/** Audit writes must never break the export they describe. */
export async function logExportRun(input: ExportRunInput): Promise<void> {
  try {
    const companyId = getActiveTenant();
    if (!companyId) return;
    const { data: auth } = await supabase.auth.getUser();
    await table("export_audit_events").insert({
      company_id: companyId,
      actor_id: auth.user?.id ?? null,
      actor_name: await actorName(auth.user?.id, auth.user?.email ?? null),
      kind: input.kind,
      format: input.format,
      template_id: input.templateId ?? null,
      template_name: input.templateName ?? null,
      template_version: input.templateVersion ?? null,
      sections: input.sections ?? [],
      recipients: input.recipients ?? [],
      schedule_id: input.scheduleId ?? null,
      status: input.status,
      error_message: input.errorMessage ?? null,
      duration_ms: input.durationMs ?? null,
      filters: input.filters ?? {},
      retry_of_id: input.retryOfId ?? null,
      attempt: input.attempt ?? 1,
      auto_retry: input.autoRetry ?? false,
    });
  } catch (error) {
    captureError(error, { area: "export-audit" });
  }
}

export const exportAuditQuery = queryOptions({
  queryKey: ["export-audit-events"],
  queryFn: async () => {
    const { data, error } = await table("export_audit_events")
      .select(
        "id,actor_name,kind,format,template_id,template_name,template_version,sections,recipients,schedule_id,status,error_message,duration_ms,retry_of_id,attempt,auto_retry,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as ExportAuditEvent[];
  },
});

export function exportAuditCsv(rows: ExportAuditEvent[]): string {
  const head = [
    "Timestamp",
    "Actor",
    "Type",
    "Format",
    "Template",
    "Template version",
    "Sections",
    "Recipients",
    "Status",
    "Error",
  ];
  const cell = (v: unknown) => {
    const text = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    head.join(","),
    ...rows.map((r) =>
      [
        new Date(r.created_at).toISOString(),
        r.actor_name ?? "System",
        r.kind,
        r.format,
        r.template_name ?? "Full board pack",
        r.template_version ?? "",
        r.sections.join(" | "),
        r.recipients.join(" | "),
        r.status,
        r.error_message ?? "",
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\n");
}

/** A failed run can be retried when nothing later already succeeded for it. */
export function isRetryable(row: ExportAuditEvent, rows: ExportAuditEvent[]): boolean {
  if (row.status !== "failed") return false;
  return !rows.some((other) => other.retry_of_id === row.id && other.status === "success");
}

export function attemptsFor(row: ExportAuditEvent, rows: ExportAuditEvent[]): number {
  const rootId = row.retry_of_id ?? row.id;
  return rows.filter((r) => r.id === rootId || r.retry_of_id === rootId).length;
}
