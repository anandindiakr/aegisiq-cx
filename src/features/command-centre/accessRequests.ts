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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export type AccessRequestStatus = "pending" | "approved" | "denied";

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
  created_at: string;
}

const COLUMNS =
  "id,widget_id,requester_id,requester_name,requester_email,reason,context,status,decided_by_name,decided_at,decision_note,created_at";

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

export async function requestWidgetAccess(input: {
  widgetId: string;
  reason: string;
  context?: string;
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
  });
  if (error) throw new Error(error.message);
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
}
