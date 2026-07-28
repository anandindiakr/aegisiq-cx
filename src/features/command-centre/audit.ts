/**
 * Dashboard governance trail.
 *
 * Every change to the executive dashboard configuration — hiding or reordering
 * a widget, altering the refresh policy, editing a scheduled report or a board
 * report template — is written to an append-only table with the actor and a
 * before/after snapshot so compliance can reconstruct who changed what.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import { captureError } from "@/lib/observability";

const DASHBOARD_KEY = "executive-command-centre";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export interface DashboardAuditEvent {
  id: string;
  actor_name: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string;
  changed_fields: string[];
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  created_at: string;
}

export interface DashboardAuditInput {
  entityType: "dashboard_layout" | "report_schedule" | "report_template";
  entityId?: string | null;
  action: "created" | "updated" | "deleted" | "reset";
  summary: string;
  changedFields?: string[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/** Audit writes must never break the user action that triggered them. */
export async function logDashboardAudit(input: DashboardAuditInput): Promise<void> {
  try {
    const companyId = getActiveTenant();
    if (!companyId) return;
    const { data: auth } = await supabase.auth.getUser();
    let actorName: string | null = auth.user?.email ?? null;
    if (auth.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      actorName = profile?.full_name ?? actorName;
    }
    await table("dashboard_audit_events").insert({
      company_id: companyId,
      actor_id: auth.user?.id ?? null,
      actor_name: actorName,
      dashboard_key: DASHBOARD_KEY,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
      summary: input.summary,
      changed_fields: input.changedFields ?? [],
      before_state: input.before ?? {},
      after_state: input.after ?? {},
    });
  } catch (error) {
    captureError(error, { area: "dashboard-audit" });
  }
}

export const dashboardAuditQuery = queryOptions({
  queryKey: ["dashboard-audit-events"],
  queryFn: async () => {
    const { data, error } = await table("dashboard_audit_events")
      .select(
        "id,actor_name,entity_type,entity_id,action,summary,changed_fields,before_state,after_state,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as DashboardAuditEvent[];
  },
});

export function auditCsv(rows: DashboardAuditEvent[]): string {
  const head = ["Timestamp", "Actor", "Entity", "Action", "Summary", "Changed fields"];
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
        r.entity_type,
        r.action,
        r.summary,
        r.changed_fields.join(" | "),
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\n");
}

/** Describes the difference between two saved dashboard layouts. */
export function describeLayoutChange(
  before: {
    hidden_widgets: string[];
    widget_order: string[];
    auto_refresh: boolean;
    refresh_interval_seconds: number;
  },
  after: {
    hidden_widgets: string[];
    widget_order: string[];
    auto_refresh: boolean;
    refresh_interval_seconds: number;
  },
): { fields: string[]; summary: string } {
  const fields: string[] = [];
  const parts: string[] = [];

  const hiddenBefore = new Set(before.hidden_widgets);
  const hiddenAfter = new Set(after.hidden_widgets);
  const newlyHidden = after.hidden_widgets.filter((w) => !hiddenBefore.has(w));
  const newlyShown = before.hidden_widgets.filter((w) => !hiddenAfter.has(w));
  if (newlyHidden.length) {
    fields.push("hidden_widgets");
    parts.push(`hid ${newlyHidden.join(", ")}`);
  }
  if (newlyShown.length) {
    if (!fields.includes("hidden_widgets")) fields.push("hidden_widgets");
    parts.push(`showed ${newlyShown.join(", ")}`);
  }
  if (before.widget_order.join(",") !== after.widget_order.join(",")) {
    fields.push("widget_order");
    parts.push("reordered widgets");
  }
  if (before.auto_refresh !== after.auto_refresh) {
    fields.push("auto_refresh");
    parts.push(`auto refresh ${after.auto_refresh ? "on" : "off"}`);
  }
  if (before.refresh_interval_seconds !== after.refresh_interval_seconds) {
    fields.push("refresh_interval_seconds");
    parts.push(`refresh every ${after.refresh_interval_seconds}s`);
  }

  return {
    fields,
    summary: parts.length ? `Dashboard settings: ${parts.join("; ")}` : "Dashboard settings saved",
  };
}
