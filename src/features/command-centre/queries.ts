/**
 * Executive Command Centre — service layer.
 *
 * All reads go through the tenant-scoped `executive_overview` database
 * function, plus small tables for report schedules and per-user layouts.
 * No widget talks to Supabase directly.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant } from "@/features/platform/queries";
import type { CommandFilters } from "./filters";
import { toRpcPayload } from "./filters";
import type { ExecutiveOverview } from "./types";
import { describeLayoutChange, logDashboardAudit } from "./audit";

// The generated database types lag behind new migrations; a narrow cast keeps
// the service layer strongly typed at its own boundary.
type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => never;
};

const rpcClient = supabase as unknown as RpcClient;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Normalises Postgres `numeric` values (delivered as strings) to numbers. */
function normalise(raw: ExecutiveOverview): ExecutiveOverview {
  const k = raw.kpis;
  return {
    ...raw,
    kpis: Object.fromEntries(
      Object.entries(k ?? {}).map(([key, value]) => [key, num(value)]),
    ) as unknown as ExecutiveOverview["kpis"],
    sentimentPeriods: (raw.sentimentPeriods ?? []).map((p) => ({
      ...p,
      very_positive: num(p.very_positive),
      positive: num(p.positive),
      neutral: num(p.neutral),
      negative: num(p.negative),
      very_negative: num(p.very_negative),
      avg_sentiment: num(p.avg_sentiment),
      total: num(p.total),
    })),
    outlets: (raw.outlets ?? []).map((o) => ({
      ...o,
      conversations: num(o.conversations),
      avg_sentiment: num(o.avg_sentiment),
      avg_duration: num(o.avg_duration),
      negatives: num(o.negatives),
      positives: num(o.positives),
      escalations: num(o.escalations),
      complaint_rate: num(o.complaint_rate),
      positive_rate: num(o.positive_rate),
      risk_score: num(o.risk_score),
      overall_score: num(o.overall_score),
      latitude: o.latitude === null ? null : num(o.latitude),
      longitude: o.longitude === null ? null : num(o.longitude),
    })),
    regions: (raw.regions ?? []).map((r) => ({
      ...r,
      conversations: num(r.conversations),
      positives: num(r.positives),
      negatives: num(r.negatives),
      avg_duration: num(r.avg_duration),
      avg_sentiment: num(r.avg_sentiment),
      escalations: num(r.escalations),
    })),
    languages: (raw.languages ?? []).map((l) => ({
      ...l,
      conversations: num(l.conversations),
      avg_sentiment: num(l.avg_sentiment),
      prev_count: num(l.prev_count),
    })),
    keywords: (raw.keywords ?? []).map((k2) => ({
      ...k2,
      mentions: num(k2.mentions),
      avg_sentiment: num(k2.avg_sentiment),
    })),
    issues: (raw.issues ?? []).map((i) => ({
      ...i,
      occurrences: num(i.occurrences),
      avg_sentiment: num(i.avg_sentiment),
      prev_count: num(i.prev_count),
    })),
    daily: (raw.daily ?? []).map((d) => ({
      ...d,
      conversations: num(d.conversations),
      avg_sentiment: num(d.avg_sentiment),
      negatives: num(d.negatives),
    })),
    hourly: (raw.hourly ?? []).map((h) => ({
      ...h,
      hour: num(h.hour),
      conversations: num(h.conversations),
      avg_sentiment: num(h.avg_sentiment),
    })),
    alertsBySeverity: Object.fromEntries(
      Object.entries(raw.alertsBySeverity ?? {}).map(([key, v]) => [key, num(v)]),
    ),
    alertsByCategory: Object.fromEntries(
      Object.entries(raw.alertsByCategory ?? {}).map(([key, v]) => [key, num(v)]),
    ),
    recentAlerts: raw.recentAlerts ?? [],
    activity: raw.activity ?? [],
    filterOptions: {
      regions: raw.filterOptions?.regions ?? [],
      outlets: raw.filterOptions?.outlets ?? [],
      languages: raw.filterOptions?.languages ?? [],
      topics: raw.filterOptions?.topics ?? [],
      employees: raw.filterOptions?.employees ?? [],
      keywords: raw.filterOptions?.keywords ?? [],
      alertTypes: raw.filterOptions?.alertTypes ?? [],
    },
  };
}

export function executiveOverviewQuery(filters: CommandFilters) {
  const payload = toRpcPayload(filters);
  return queryOptions({
    queryKey: ["executive-overview", payload],
    staleTime: 30_000,
    queryFn: () =>
      traced("supabase.executive_overview", async () => {
        const { data, error } = await rpcClient.rpc("executive_overview", {
          p_filters: payload,
        });
        if (error) throw new Error(error.message);
        return normalise(data as ExecutiveOverview);
      }),
  });
}

// ---------------------------------------------------------------------------
// Scheduled reports
// ---------------------------------------------------------------------------

export type ReportFrequency = "daily" | "weekly" | "monthly";
export type ReportFormat = "pdf" | "excel" | "csv" | "powerpoint";

export interface ReportSchedule {
  id: string;
  name: string;
  frequency: ReportFrequency;
  format: ReportFormat;
  recipients: string[];
  send_hour: number;
  is_active: boolean;
  last_sent_at: string | null;
  auto_retry: boolean;
  max_retries: number;
  consecutive_failures: number;
  last_status: string | null;
  last_error: string | null;
  created_at: string;
}

export const reportSchedulesQuery = queryOptions({
  queryKey: ["executive-report-schedules"],
  queryFn: async () => {
    const { data, error } = await table("executive_report_schedules")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ReportSchedule[];
  },
});

export async function createReportSchedule(input: {
  name: string;
  frequency: ReportFrequency;
  format: ReportFormat;
  recipients: string[];
  send_hour: number;
  auto_retry?: boolean;
  max_retries?: number;
}) {
  const companyId = getActiveTenant();
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await table("executive_report_schedules")
    .insert({
      ...input,
      company_id: companyId,
      created_by: auth.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await logDashboardAudit({
    entityType: "report_schedule",
    entityId: data?.id ?? null,
    action: "created",
    summary: `Scheduled report "${input.name}" created (${input.frequency}, ${input.format})`,
    changedFields: ["name", "frequency", "format", "recipients", "send_hour"],
    after: input as unknown as Record<string, unknown>,
  });
}

export async function updateReportSchedule(
  id: string,
  patch: Partial<ReportSchedule>,
  before?: ReportSchedule,
) {
  const { error } = await table("executive_report_schedules").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await logDashboardAudit({
    entityType: "report_schedule",
    entityId: id,
    action: "updated",
    summary: `Scheduled report "${before?.name ?? id}" updated`,
    changedFields: Object.keys(patch),
    before: before as unknown as Record<string, unknown>,
    after: patch as unknown as Record<string, unknown>,
  });
}

export async function deleteReportSchedule(id: string, before?: ReportSchedule) {
  const { error } = await table("executive_report_schedules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logDashboardAudit({
    entityType: "report_schedule",
    entityId: id,
    action: "deleted",
    summary: `Scheduled report "${before?.name ?? id}" deleted`,
    changedFields: ["name"],
    before: before as unknown as Record<string, unknown>,
  });
}

// ---------------------------------------------------------------------------
// Per-user dashboard layout
// ---------------------------------------------------------------------------

export const DASHBOARD_KEY = "executive-command-centre";

export interface DashboardLayout {
  hidden_widgets: string[];
  widget_order: string[];
  refresh_interval_seconds: number;
  auto_refresh: boolean;
}

export const dashboardLayoutQuery = queryOptions({
  queryKey: ["dashboard-layout", DASHBOARD_KEY],
  queryFn: async (): Promise<DashboardLayout | null> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await table("dashboard_layouts")
      .select("hidden_widgets,widget_order,refresh_interval_seconds,auto_refresh")
      .eq("user_id", auth.user.id)
      .eq("dashboard_key", DASHBOARD_KEY)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as DashboardLayout | null;
  },
});

export async function saveDashboardLayout(layout: DashboardLayout, previous?: DashboardLayout) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  const { error } = await table("dashboard_layouts").upsert(
    {
      ...layout,
      user_id: auth.user.id,
      company_id: getActiveTenant(),
      dashboard_key: DASHBOARD_KEY,
    },
    { onConflict: "user_id,dashboard_key" },
  );
  if (error) throw new Error(error.message);

  if (previous) {
    const { fields, summary } = describeLayoutChange(previous, layout);
    if (fields.length > 0) {
      await logDashboardAudit({
        entityType: "dashboard_layout",
        action: "updated",
        summary,
        changedFields: fields,
        before: previous as unknown as Record<string, unknown>,
        after: layout as unknown as Record<string, unknown>,
      });
    }
  }
}
