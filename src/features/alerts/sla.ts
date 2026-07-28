/**
 * Alert SLA timers, escalation policies and triage analytics.
 *
 * Row-level security in the database is the enforcement point; everything in
 * this module is tenant-scoped client-side as well (defence in depth) and the
 * automatic escalation itself runs inside a security-definer database function
 * so a stalled critical alert always reaches its backup owner.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import type { AlertSeverity, AppRole } from "@/features/platform/queries";
import { traced } from "@/lib/observability";

// The generated database types lag behind the latest migrations.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

function tenant(): string {
  const id = getActiveTenant();
  if (!id) throw new Error("No active workspace resolved yet.");
  return id;
}

async function run<T>(
  builder: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  operation = "supabase.alert-sla",
) {
  return traced(operation, async () => {
    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    return (data ?? []) as T;
  });
}

export const ALERT_SEVERITIES: AlertSeverity[] = ["critical", "high", "medium", "low", "info"];

export interface AlertSlaPolicy {
  id: string;
  severity: AlertSeverity;
  ack_minutes: number;
  resolve_minutes: number;
  escalate_after_minutes: number;
  backup_role: AppRole | null;
  backup_user_id: string | null;
  is_active: boolean;
}

export interface AlertEscalation {
  id: string;
  alert_id: string;
  level: number;
  reason: string;
  from_user_id: string | null;
  to_user_id: string | null;
  to_user_name: string | null;
  to_role: AppRole | null;
  minutes_overdue: number;
  created_at: string;
}

/** Alert row enriched with the SLA lifecycle columns. */
export interface AlertLifecycle {
  id: string;
  outlet_id: string | null;
  severity: AlertSeverity;
  status: string;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  escalation_level: number;
  escalated_at: string | null;
  sla_breached: boolean;
  assigned_to: string | null;
}

export const alertSlaPoliciesQuery = queryOptions({
  queryKey: ["alerts", "sla-policies"],
  queryFn: async () => {
    const rows = await run<AlertSlaPolicy[]>(
      raw
        .from("alert_sla_policies")
        .select(
          "id,severity,ack_minutes,resolve_minutes,escalate_after_minutes,backup_role,backup_user_id,is_active",
        )
        .eq("company_id", tenant()),
      "supabase.alert-sla-policies",
    );
    return new Map(rows.map((row) => [row.severity, row]));
  },
  staleTime: 60_000,
});

export function alertEscalationsQuery(alertId: string | null) {
  return queryOptions({
    queryKey: ["alerts", "escalations", alertId],
    enabled: Boolean(alertId),
    queryFn: () =>
      run<AlertEscalation[]>(
        raw
          .from("alert_escalations")
          .select(
            "id,alert_id,level,reason,from_user_id,to_user_id,to_user_name,to_role,minutes_overdue,created_at",
          )
          .eq("company_id", tenant())
          .eq("alert_id", alertId)
          .order("created_at", { ascending: false }),
        "supabase.alert-escalations",
      ),
  });
}

/** Recent escalations across the estate, used by the analytics dashboard. */
export const recentEscalationsQuery = queryOptions({
  queryKey: ["alerts", "escalations", "recent"],
  queryFn: () =>
    run<AlertEscalation[]>(
      raw
        .from("alert_escalations")
        .select(
          "id,alert_id,level,reason,from_user_id,to_user_id,to_user_name,to_role,minutes_overdue,created_at",
        )
        .eq("company_id", tenant())
        .order("created_at", { ascending: false })
        .limit(50),
      "supabase.alert-escalations-recent",
    ),
  staleTime: 30_000,
});

/** Lifecycle-only alert rows for analytics (90-day window). */
export const alertLifecycleQuery = queryOptions({
  queryKey: ["alerts", "lifecycle"],
  queryFn: () =>
    run<AlertLifecycle[]>(
      raw
        .from("alerts")
        .select(
          "id,outlet_id,severity,status,triggered_at,acknowledged_at,resolved_at,escalation_level,escalated_at,sla_breached,assigned_to",
        )
        .eq("company_id", tenant())
        .is("deleted_at", null)
        .gte("triggered_at", new Date(Date.now() - 90 * 86_400_000).toISOString())
        .order("triggered_at", { ascending: false })
        .limit(2000),
      "supabase.alert-lifecycle",
    ),
  staleTime: 60_000,
});

export async function saveAlertSlaPolicy(policy: {
  id?: string;
  severity: AlertSeverity;
  ack_minutes: number;
  resolve_minutes: number;
  escalate_after_minutes: number;
  backup_role: AppRole | null;
  backup_user_id: string | null;
  is_active: boolean;
}) {
  const payload = { ...policy, company_id: tenant() };
  if (policy.id) {
    const { error } = await raw.from("alert_sla_policies").update(payload).eq("id", policy.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await raw.from("alert_sla_policies").insert(payload);
  if (error) throw new Error(error.message);
}

/** Runs the escalation sweep; returns how many alerts were handed to a backup. */
export async function runEscalationSweep(): Promise<number> {
  const { data, error } = await (
    supabase as unknown as {
      rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("escalate_overdue_alerts");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

// ---------------------------------------------------------------------------
// SLA maths
// ---------------------------------------------------------------------------

export type SlaState = "met" | "running" | "warning" | "breached" | "none";

export interface AlertSlaStatus {
  state: SlaState;
  /** Milliseconds until the applicable deadline; negative when overdue. */
  remainingMs: number;
  dueAt: Date | null;
  /** Which clock is being tracked right now. */
  clock: "acknowledge" | "resolve" | "closed";
  label: string;
}

const MINUTE = 60_000;

export function describeMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Number(hours.toFixed(hours % 1 === 0 ? 0 : 1))}h`;
  return `${Number((hours / 24).toFixed(1))}d`;
}

export function describeCountdown(ms: number): string {
  const overdue = ms < 0;
  const total = Math.abs(ms);
  const mins = Math.floor(total / MINUTE);
  const text =
    mins < 60
      ? `${mins}m`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ${mins % 60}m`
        : `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
  return overdue ? `${text} overdue` : `${text} left`;
}

/** Computes the live SLA position of an alert against its severity policy. */
export function alertSlaStatus(
  alert: Pick<
    AlertLifecycle,
    "severity" | "status" | "triggered_at" | "acknowledged_at" | "resolved_at"
  >,
  policy: AlertSlaPolicy | undefined,
  now: number = Date.now(),
): AlertSlaStatus {
  if (!policy || !policy.is_active) {
    return { state: "none", remainingMs: 0, dueAt: null, clock: "closed", label: "No SLA" };
  }
  const triggered = new Date(alert.triggered_at).getTime();

  if (alert.status === "resolved" || alert.status === "dismissed") {
    const closed = alert.resolved_at ? new Date(alert.resolved_at).getTime() : now;
    const due = triggered + policy.resolve_minutes * MINUTE;
    const met = closed <= due;
    return {
      state: met ? "met" : "breached",
      remainingMs: due - closed,
      dueAt: new Date(due),
      clock: "closed",
      label: met
        ? `Closed within SLA (${describeCountdown(due - closed).replace(" left", " to spare")})`
        : `Closed ${describeCountdown(due - closed)}`,
    };
  }

  const acknowledged = Boolean(alert.acknowledged_at) || alert.status === "acknowledged";
  const clock: "acknowledge" | "resolve" = acknowledged ? "resolve" : "acknowledge";
  const minutes = acknowledged ? policy.resolve_minutes : policy.ack_minutes;
  const due = triggered + minutes * MINUTE;
  const remainingMs = due - now;
  const warnAt = minutes * MINUTE * 0.25;
  const state: SlaState =
    remainingMs < 0 ? "breached" : remainingMs <= warnAt ? "warning" : "running";
  return {
    state,
    remainingMs,
    dueAt: new Date(due),
    clock,
    label: `${clock === "acknowledge" ? "Acknowledge" : "Resolve"} · ${describeCountdown(remainingMs)}`,
  };
}

export const SLA_TONE: Record<SlaState, "positive" | "warning" | "negative" | "neutral" | "info"> =
  {
    met: "positive",
    running: "info",
    warning: "warning",
    breached: "negative",
    none: "neutral",
  };

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface AlertAnalytics {
  total: number;
  open: number;
  breached: number;
  escalated: number;
  /** Mean time to acknowledge, in minutes. */
  mtta: number | null;
  /** Mean time to resolve, in minutes. */
  mttr: number | null;
  bySeverity: { label: string; value: number }[];
  byStatus: { label: string; value: number }[];
  byOutlet: { label: string; value: number; breached: number; mttr: number | null }[];
  trend: { label: string; value: number; secondary: number }[];
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Aggregates MTTA/MTTR and distribution metrics from the tenant alert set. */
export function buildAlertAnalytics(
  alerts: AlertLifecycle[],
  outletName: (id: string | null) => string,
  days = 30,
): AlertAnalytics {
  const since = Date.now() - days * 86_400_000;
  const scoped = alerts.filter((a) => new Date(a.triggered_at).getTime() >= since);

  const ackDeltas: number[] = [];
  const resolveDeltas: number[] = [];
  const severity = new Map<string, number>();
  const status = new Map<string, number>();
  const outlets = new Map<string, { total: number; breached: number; resolve: number[] }>();
  const trend = new Map<string, { value: number; secondary: number }>();

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    trend.set(day, { value: 0, secondary: 0 });
  }

  for (const alert of scoped) {
    const triggered = new Date(alert.triggered_at).getTime();
    if (alert.acknowledged_at) {
      ackDeltas.push((new Date(alert.acknowledged_at).getTime() - triggered) / MINUTE);
    }
    if (alert.resolved_at) {
      resolveDeltas.push((new Date(alert.resolved_at).getTime() - triggered) / MINUTE);
    }

    severity.set(alert.severity, (severity.get(alert.severity) ?? 0) + 1);
    status.set(alert.status, (status.get(alert.status) ?? 0) + 1);

    const key = outletName(alert.outlet_id);
    const bucket = outlets.get(key) ?? { total: 0, breached: 0, resolve: [] };
    bucket.total += 1;
    if (alert.sla_breached) bucket.breached += 1;
    if (alert.resolved_at) {
      bucket.resolve.push((new Date(alert.resolved_at).getTime() - triggered) / MINUTE);
    }
    outlets.set(key, bucket);

    const day = alert.triggered_at.slice(0, 10);
    const point = trend.get(day);
    if (point) {
      point.value += 1;
      if (alert.severity === "critical" || alert.severity === "high") point.secondary += 1;
    }
  }

  return {
    total: scoped.length,
    open: scoped.filter((a) => a.status === "open" || a.status === "acknowledged").length,
    breached: scoped.filter((a) => a.sla_breached).length,
    escalated: scoped.filter((a) => (a.escalation_level ?? 0) > 0).length,
    mtta: mean(ackDeltas),
    mttr: mean(resolveDeltas),
    bySeverity: ALERT_SEVERITIES.filter((s) => severity.has(s)).map((s) => ({
      label: s,
      value: severity.get(s) ?? 0,
    })),
    byStatus: [...status.entries()].map(([label, value]) => ({ label, value })),
    byOutlet: [...outlets.entries()]
      .map(([label, bucket]) => ({
        label,
        value: bucket.total,
        breached: bucket.breached,
        mttr: mean(bucket.resolve),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    trend: [...trend.entries()].map(([day, point]) => ({
      label: day.slice(5),
      value: point.value,
      secondary: point.secondary,
    })),
  };
}
