import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import type { AlertStatus } from "@/features/platform/queries";
import { traced } from "@/lib/observability";

// The generated database types lag behind the latest migrations, so the live
// monitor talks to Supabase through a narrow untyped surface. Every query is
// still tenant-scoped client-side (defence in depth) on top of RLS.
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
  operation = "supabase.live-monitor",
) {
  return traced(operation, async () => {
    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    return (data ?? []) as T;
  });
}

export interface LiveConversation {
  id: string;
  reference: string;
  outlet_id: string | null;
  camera_id: string | null;
  started_at: string;
  duration_seconds: number;
  language_code: string;
  sentiment: string;
  sentiment_score: number;
  topic: string | null;
  agent_name: string | null;
  escalated: boolean;
}

export interface AlertNote {
  id: string;
  alert_id: string;
  user_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

/** Most recent conversations, used for the live activity ticker. */
export const liveConversationsQuery = queryOptions({
  queryKey: ["live-monitor", "conversations"],
  queryFn: () =>
    run<LiveConversation[]>(
      raw
        .from("conversations")
        .select(
          "id,reference,outlet_id,camera_id,started_at,duration_seconds,language_code,sentiment,sentiment_score,topic,agent_name,escalated",
        )
        .eq("company_id", tenant())
        .order("started_at", { ascending: false })
        .limit(60),
      "supabase.live-conversations",
    ),
  staleTime: 15_000,
});

export function alertNotesQuery(alertId: string | null) {
  return queryOptions({
    queryKey: ["live-monitor", "alert-notes", alertId],
    enabled: Boolean(alertId),
    queryFn: () =>
      run<AlertNote[]>(
        raw
          .from("alert_notes")
          .select("id,alert_id,user_id,author_name,body,created_at")
          .eq("company_id", tenant())
          .eq("alert_id", alertId)
          .order("created_at", { ascending: false }),
        "supabase.alert-notes",
      ),
  });
}

export async function addAlertNote(alertId: string, body: string, authorName: string | null) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Your session expired. Please sign in again.");
  const { error } = await raw.from("alert_notes").insert({
    company_id: tenant(),
    alert_id: alertId,
    user_id: auth.user.id,
    author_name: authorName,
    body,
  });
  if (error) throw new Error(error.message);
}

export async function deleteAlertNote(id: string) {
  const { error } = await raw.from("alert_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function assignAlert(alertId: string, userId: string | null) {
  const { error } = await raw
    .from("alerts")
    .update({
      assigned_to: userId,
      assigned_at: userId ? new Date().toISOString() : null,
    })
    .eq("company_id", tenant())
    .eq("id", alertId);
  if (error) throw new Error(error.message);
}

export async function bulkUpdateAlertStatus(ids: string[], status: AlertStatus) {
  if (ids.length === 0) return;
  const { error } = await raw
    .from("alerts")
    .update({
      status,
      acknowledged_at: status === "open" ? null : new Date().toISOString(),
    })
    .eq("company_id", tenant())
    .in("id", ids);
  if (error) throw new Error(error.message);
}
