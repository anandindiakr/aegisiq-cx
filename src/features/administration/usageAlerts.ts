/**
 * Usage governance automation.
 *
 * Three concerns live here:
 *  1. CSV export of metered consumption (tenant roll-up + per outlet).
 *  2. Scheduled CSV report definitions.
 *  3. Threshold / throttle / anomaly alert rules and the events they raise.
 *
 * Evaluation itself is server side (`public.evaluate_usage_alerts`) so the
 * numbers a person sees and the numbers that trigger a notification can never
 * diverge, and row-level security keeps everything tenant scoped.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";

// Generated types lag behind this migration; RLS is the real gate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = supabase as unknown as { from: (table: string) => any; rpc: (fn: string, args?: unknown) => any };

export type UsageMetric = "copilot_queries" | "audio_minutes" | "storage_gb" | "egress_gb";

export const METRIC_LABELS: Record<UsageMetric, string> = {
  copilot_queries: "Copilot queries",
  audio_minutes: "Audio minutes",
  storage_gb: "Storage (GB)",
  egress_gb: "Egress (GB)",
};

export const USAGE_METRICS: UsageMetric[] = [
  "copilot_queries",
  "audio_minutes",
  "storage_gb",
  "egress_gb",
];

/* ---------------------------------------------------------------- */
/* CSV export                                                        */
/* ---------------------------------------------------------------- */

export interface UsageExportRow {
  scope: "tenant" | "outlet";
  outlet_name: string | null;
  outlet_code: string | null;
  region: string | null;
  period_month: string;
  copilot_queries: number;
  query_limit: number;
  audio_minutes: number;
  audio_minutes_limit: number;
  storage_gb: number;
  egress_gb: number;
  ai_tokens: number;
  queries_remaining: number;
  audio_minutes_remaining: number;
  throttled: boolean;
}

const CSV_COLUMNS: { key: keyof UsageExportRow; header: string }[] = [
  { key: "scope", header: "Scope" },
  { key: "outlet_name", header: "Outlet" },
  { key: "outlet_code", header: "Code" },
  { key: "region", header: "Region" },
  { key: "period_month", header: "Period" },
  { key: "copilot_queries", header: "Copilot queries" },
  { key: "query_limit", header: "Query allowance" },
  { key: "queries_remaining", header: "Queries remaining" },
  { key: "audio_minutes", header: "Audio minutes" },
  { key: "audio_minutes_limit", header: "Audio allowance (min)" },
  { key: "audio_minutes_remaining", header: "Audio remaining (min)" },
  { key: "storage_gb", header: "Storage (GB)" },
  { key: "egress_gb", header: "Egress (GB)" },
  { key: "ai_tokens", header: "AI tokens" },
  { key: "throttled", header: "Throttled" },
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(Math.round(value * 100) / 100) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function usageRowsToCsv(rows: UsageExportRow[]): string {
  const head = CSV_COLUMNS.map((c) => c.header).join(",");
  const body = rows
    .map((row) => CSV_COLUMNS.map((c) => csvCell(row[c.key])).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

export async function fetchUsageExportRows(month?: string): Promise<UsageExportRow[]> {
  const { data, error } = await raw.rpc("usage_export_rows", { _month: month ?? null });
  if (error) throw new Error(error.message);
  return (data ?? []) as UsageExportRow[];
}

export function downloadCsv(filename: string, body: string) {
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Pulls the flat metering rows and hands the browser a CSV file. */
export async function exportUsageCsv(month?: string) {
  const rows = await fetchUsageExportRows(month);
  const stamp = (month ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  downloadCsv(`aegisiq-usage-${stamp}.csv`, usageRowsToCsv(rows));
  return rows.length;
}

/* ---------------------------------------------------------------- */
/* Scheduled reports                                                 */
/* ---------------------------------------------------------------- */

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

export interface UsageReportSchedule {
  id: string;
  company_id: string;
  name: string;
  frequency: ScheduleFrequency;
  scope: "tenant" | "outlet";
  format: "csv";
  recipients: string[];
  send_hour: number;
  is_active: boolean;
  last_sent_at: string | null;
  last_status: string | null;
  created_at: string;
}

export const usageSchedulesQuery = queryOptions({
  queryKey: ["usage", "report-schedules"],
  queryFn: async () => {
    const { data, error } = await raw
      .from("usage_report_schedules")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as UsageReportSchedule[];
  },
});

export async function saveUsageSchedule(patch: Partial<UsageReportSchedule> & { id?: string }) {
  const company = getActiveTenant();
  if (!company) throw new Error("No workspace in context");
  const { id, ...rest } = patch;
  const { error } = id
    ? await raw.from("usage_report_schedules").update(rest).eq("id", id)
    : await raw.from("usage_report_schedules").insert({ company_id: company, ...rest });
  if (error) throw new Error(error.message);
}

export async function deleteUsageSchedule(id: string) {
  const { error } = await raw.from("usage_report_schedules").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Marks a schedule as run and downloads the same CSV it would deliver. */
export async function runUsageScheduleNow(schedule: UsageReportSchedule) {
  const rows = await fetchUsageExportRows();
  const filtered = schedule.scope === "tenant" ? rows.filter((r) => r.scope === "tenant") : rows;
  const slug = schedule.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadCsv(`${slug || "usage"}-${new Date().toISOString().slice(0, 10)}.csv`, usageRowsToCsv(filtered));
  await raw
    .from("usage_report_schedules")
    .update({ last_sent_at: new Date().toISOString(), last_status: "downloaded" })
    .eq("id", schedule.id);
  return filtered.length;
}

/* ---------------------------------------------------------------- */
/* Alert rules and events                                            */
/* ---------------------------------------------------------------- */

export interface UsageAlertRule {
  id: string;
  company_id: string;
  metric: UsageMetric;
  enabled: boolean;
  warn_pct: number;
  critical_pct: number;
  spike_multiplier: number;
  min_baseline: number;
  notify_tenant_admins: boolean;
  notify_super_admin: boolean;
}

export const usageAlertRulesQuery = queryOptions({
  queryKey: ["usage", "alert-rules"],
  queryFn: async () => {
    const { data, error } = await raw.from("usage_alert_rules").select("*").order("metric");
    if (error) throw new Error(error.message);
    return (data ?? []) as UsageAlertRule[];
  },
});

export async function saveUsageAlertRule(metric: UsageMetric, patch: Partial<UsageAlertRule>) {
  const company = getActiveTenant();
  if (!company) throw new Error("No workspace in context");
  const { error } = await raw
    .from("usage_alert_rules")
    .upsert({ company_id: company, metric, ...patch }, { onConflict: "company_id,metric" });
  if (error) throw new Error(error.message);
}

export type UsageEventKind = "threshold" | "throttle" | "anomaly";

export interface UsageAlertEvent {
  id: string;
  outlet_id: string | null;
  outlet_name: string | null;
  metric: UsageMetric;
  kind: UsageEventKind;
  severity: "info" | "warning" | "critical";
  scope: "tenant" | "outlet";
  observed: number;
  baseline: number | null;
  limit_value: number | null;
  pct: number | null;
  message: string;
  acknowledged_at: string | null;
  created_at: string;
}

export const usageAlertEventsQuery = queryOptions({
  queryKey: ["usage", "alert-events"],
  queryFn: async () => {
    const { data, error } = await raw
      .from("usage_alert_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as UsageAlertEvent[];
  },
});

/** Runs the server-side evaluator; returns how many fresh events were raised. */
export async function evaluateUsageAlerts(): Promise<number> {
  const { data, error } = await raw.rpc("evaluate_usage_alerts", {});
  if (error) throw new Error(error.message);
  return Number((data as { created?: number } | null)?.created ?? 0);
}

export async function acknowledgeUsageEvent(id: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await raw
    .from("usage_alert_events")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: auth.user?.id ?? null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export const KIND_LABELS: Record<UsageEventKind, string> = {
  threshold: "Approaching limit",
  throttle: "Throttling active",
  anomaly: "Anomalous spike",
};

/* ---------------------------------------------------------------- */
/* Cross-tenant view (super admin)                                   */
/* ---------------------------------------------------------------- */

export interface PlatformTenantUsage {
  id: string;
  name: string;
  queries: number;
  audio_minutes: number;
  storage_gb: number;
  egress_gb: number;
  included_queries: number;
  included_audio_minutes: number;
  monthly_budget: number;
  currency: string;
}

export const platformUsageQuery = queryOptions({
  queryKey: ["platform", "usage-overview"],
  queryFn: async () => {
    const { data, error } = await raw.rpc("platform_usage_overview", { _month: null });
    if (error) throw new Error(error.message);
    return ((data?.tenants ?? []) as PlatformTenantUsage[]);
  },
});
