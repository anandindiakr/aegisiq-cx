/**
 * Request-access flow for restricted Command Centre widgets.
 *
 * When `widget_access_rules` hides a widget (or blocks a deep link into
 * ConversationIQ), the viewer can raise a request instead of hitting a dead
 * end. Workspace admins review the queue and, on approval, the requester's
 * roles are added to the widget's access rule — the same server-side rule that
 * `allowed_widgets()` and `can_view_widget()` evaluate.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant, type AppRole } from "@/features/platform/queries";
import { logExportAction } from "./exportActions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export type AccessRequestStatus = "pending" | "approved" | "denied" | "expired";

/** Default turnaround target for a new request (8 working hours). */
export const DEFAULT_ACCESS_SLA_MINUTES = 480;

export interface WidgetAccessRequest {
  id: string;
  widget_id: string;
  requester_id: string;
  requester_name: string | null;
  requester_email: string | null;
  reason: string | null;
  context: string | null;
  status: AccessRequestStatus;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  sla_minutes: number;
  due_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export type SlaState = "on_track" | "due_soon" | "breached" | "settled";

export interface AccessRequestSla {
  state: SlaState;
  label: string;
  /** Minutes from raise to decision, or to now while still pending. */
  turnaroundMinutes: number;
}

/** Turnaround and breach state for one request. */
export function accessRequestSla(request: WidgetAccessRequest): AccessRequestSla {
  const created = new Date(request.created_at).getTime();
  const settledAt = request.decided_at ? new Date(request.decided_at).getTime() : null;
  const turnaroundMinutes = Math.max(0, Math.round(((settledAt ?? Date.now()) - created) / 60_000));

  if (request.status !== "pending") {
    return {
      state: "settled",
      label: `Settled in ${formatMinutes(turnaroundMinutes)}`,
      turnaroundMinutes,
    };
  }

  const due = request.due_at
    ? new Date(request.due_at).getTime()
    : created + (request.sla_minutes ?? DEFAULT_ACCESS_SLA_MINUTES) * 60_000;
  const remaining = Math.round((due - Date.now()) / 60_000);
  if (remaining < 0) {
    return {
      state: "breached",
      label: `Overdue by ${formatMinutes(Math.abs(remaining))}`,
      turnaroundMinutes,
    };
  }
  if (remaining <= (request.sla_minutes ?? DEFAULT_ACCESS_SLA_MINUTES) * 0.25) {
    return { state: "due_soon", label: `Due in ${formatMinutes(remaining)}`, turnaroundMinutes };
  }
  return { state: "on_track", label: `Due in ${formatMinutes(remaining)}`, turnaroundMinutes };
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** Median turnaround across settled requests, for the queue header. */
export function averageTurnaround(requests: WidgetAccessRequest[]): number | null {
  const settled = requests
    .filter((r) => r.decided_at)
    .map((r) => accessRequestSla(r).turnaroundMinutes)
    .sort((a, b) => a - b);
  if (settled.length === 0) return null;
  return settled[Math.floor(settled.length / 2)];
}

const COLUMNS =
  "id,widget_id,requester_id,requester_name,requester_email,reason,context,status,decided_by_name,decided_at,decision_note,sla_minutes,due_at,expires_at,created_at";

export const widgetAccessRequestsQuery = queryOptions({
  queryKey: ["widget-access-requests"],
  queryFn: async () => {
    const { data, error } = await table("widget_access_requests")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as WidgetAccessRequest[];
  },
});

/** Pending request the viewer already has for this widget, if any. */
export function existingPendingRequest(
  requests: WidgetAccessRequest[],
  widgetId: string,
  userId: string | undefined,
): WidgetAccessRequest | undefined {
  return requests.find(
    (r) => r.status === "pending" && r.widget_id === widgetId && r.requester_id === userId,
  );
}

/** Ages out pending requests past their expiry so viewers can re-raise them. */
export async function expireStaleAccessRequests(): Promise<number> {
  const { data, error } = await (
    supabase as unknown as {
      rpc: (
        name: string,
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("expire_widget_access_requests");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function requestWidgetAccess(input: {
  widgetId: string;
  reason: string;
  context?: string;
  slaMinutes?: number;
}) {
  const companyId = getActiveTenant();
  if (!companyId) throw new Error("No active workspace.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const { error } = await table("widget_access_requests").insert({
    company_id: companyId,
    widget_id: input.widgetId,
    requester_id: auth.user.id,
    requester_name: profile?.full_name ?? auth.user.email ?? null,
    requester_email: auth.user.email ?? null,
    reason: input.reason,
    context: input.context ?? null,
    status: "pending",
    sla_minutes: input.slaMinutes ?? DEFAULT_ACCESS_SLA_MINUTES,
  });
  if (error) throw new Error(error.message);

  await logExportAction({
    action: "access_requested",
    widgetId: input.widgetId,
    surface: input.context ?? "command-centre",
    detail: input.reason,
  });
}

async function decidedBy() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { id: null as string | null, name: null as string | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return { id: auth.user.id, name: profile?.full_name ?? auth.user.email ?? null };
}

/** Grants the requester's roles on the widget rule, then closes the request. */
export async function approveWidgetAccess(request: WidgetAccessRequest, note?: string) {
  const companyId = getActiveTenant();
  if (!companyId) throw new Error("No active workspace.");

  const { data: grants, error: grantsError } = await table("user_roles")
    .select("role")
    .eq("user_id", request.requester_id);
  if (grantsError) throw new Error(grantsError.message);
  const roles = Array.from(
    new Set(((grants ?? []) as { role: AppRole }[]).map((g) => g.role)),
  ) as AppRole[];
  if (roles.length === 0) throw new Error("The requester holds no roles to grant this widget to.");

  const { data: rule, error: ruleError } = await table("widget_access_rules")
    .select("id,roles")
    .eq("company_id", companyId)
    .eq("widget_id", request.widget_id)
    .maybeSingle();
  if (ruleError) throw new Error(ruleError.message);

  if (rule) {
    const merged = Array.from(new Set([...(rule.roles ?? []), ...roles]));
    const { error } = await table("widget_access_rules")
      .update({ roles: merged })
      .eq("id", rule.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await table("widget_access_rules").insert({
      company_id: companyId,
      widget_id: request.widget_id,
      roles,
    });
    if (error) throw new Error(error.message);
  }

  await closeRequest(request.id, "approved", note ?? `Granted to ${roles.join(", ")}`);
}

export async function denyWidgetAccess(request: WidgetAccessRequest, note?: string) {
  await closeRequest(request.id, "denied", note ?? null);
}

/** Marks a single stale request expired without granting anything. */
export async function expireWidgetAccess(request: WidgetAccessRequest) {
  await closeRequest(request.id, "expired", "Expired without a decision");
}

async function closeRequest(id: string, status: AccessRequestStatus, note: string | null) {
  const actor = await decidedBy();
  const { error } = await table("widget_access_requests")
    .update({
      status,
      decided_by: actor.id,
      decided_by_name: actor.name,
      decided_at: new Date().toISOString(),
      decision_note: note,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await logExportAction({
    action: "access_decided",
    outcome: status === "approved" ? "ok" : "cancelled",
    detail: `${status}${note ? ` — ${note}` : ""}`,
  });
}
