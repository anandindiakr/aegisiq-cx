import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant } from "@/features/platform/queries";
import type { AlertStatus } from "@/features/platform/queries";

/**
 * ConversationIQ™ review layer — internal notes, review tags and the
 * append-only alert activity trail. Every read and write is tenant-scoped in
 * the client as well as by row-level security in the database.
 */

// Generated database types lag behind the review migration; this module keeps
// its own row interfaces and reads through an untyped builder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

function scoped(table: string, columns = "*"): AnyBuilder {
  const builder = raw.from(table).select(columns);
  const company = getActiveTenant();
  return company ? builder.eq("company_id", company) : builder;
}

async function run<T>(
  builder: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  op: string,
) {
  return traced(op, async () => {
    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    return (data ?? []) as T;
  });
}

export interface ConversationNote {
  id: string;
  conversation_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationTag {
  id: string;
  conversation_id: string;
  tag: string;
  created_by: string | null;
  created_at: string;
}

export interface AlertEvent {
  id: string;
  alert_id: string;
  actor_id: string | null;
  actor_name: string | null;
  from_status: AlertStatus | null;
  to_status: AlertStatus;
  note: string | null;
  created_at: string;
}

const NOTE_COLUMNS = "id,conversation_id,author_id,author_name,body,created_at,updated_at";
const TAG_COLUMNS = "id,conversation_id,tag,created_by,created_at";
const ALERT_EVENT_COLUMNS =
  "id,alert_id,actor_id,actor_name,from_status,to_status,note,created_at";

async function currentActor() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const meta = (user?.user_metadata ?? {}) as { full_name?: string };
  return {
    id: user?.id ?? null,
    name: meta.full_name ?? user?.email ?? "Unknown reviewer",
  };
}

// --- Notes -----------------------------------------------------------------

export function conversationNotesQuery(conversationId: string) {
  return queryOptions({
    queryKey: ["iq", "notes", conversationId],
    queryFn: () =>
      run<ConversationNote[]>(
        scoped("conversation_notes", NOTE_COLUMNS)
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false }),
        "iq.conversation_notes",
      ),
  });
}

export async function addConversationNote(conversationId: string, body: string) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const actor = await currentActor();
  const { error } = await raw.from("conversation_notes").insert({
    company_id: company,
    conversation_id: conversationId,
    author_id: actor.id,
    author_name: actor.name,
    body,
  });
  if (error) throw new Error(error.message);
}

export async function updateConversationNote(id: string, body: string) {
  const company = getActiveTenant();
  let query = raw.from("conversation_notes").update({ body }).eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteConversationNote(id: string) {
  const company = getActiveTenant();
  let query = raw.from("conversation_notes").delete().eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

// --- Tags ------------------------------------------------------------------

export function conversationTagsQuery(conversationId: string) {
  return queryOptions({
    queryKey: ["iq", "tags", conversationId],
    queryFn: () =>
      run<ConversationTag[]>(
        scoped("conversation_tags", TAG_COLUMNS)
          .eq("conversation_id", conversationId)
          .order("created_at"),
        "iq.conversation_tags",
      ),
  });
}

/** Every tag in the workspace, indexed by conversation for list filtering. */
export const iqTagIndexQuery = queryOptions({
  queryKey: ["iq", "tag-index"],
  queryFn: async () => {
    const rows = await run<ConversationTag[]>(
      scoped("conversation_tags", TAG_COLUMNS).limit(20000),
      "iq.tag_index",
    );
    const byConversation = new Map<string, string[]>();
    const counts = new Map<string, number>();
    for (const row of rows) {
      const list = byConversation.get(row.conversation_id) ?? [];
      list.push(row.tag);
      byConversation.set(row.conversation_id, list);
      counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
    }
    return { byConversation, counts, rows };
  },
});

export async function addConversationTag(conversationId: string, tag: string) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const actor = await currentActor();
  const { error } = await raw.from("conversation_tags").insert({
    company_id: company,
    conversation_id: conversationId,
    tag: tag.trim().toLowerCase(),
    created_by: actor.id,
  });
  if (error) {
    throw new Error(
      error.message.includes("duplicate") ? "That tag is already applied." : error.message,
    );
  }
}

export async function removeConversationTag(id: string) {
  const company = getActiveTenant();
  let query = raw.from("conversation_tags").delete().eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

// --- Alert review ----------------------------------------------------------

export function alertEventsQuery(alertIds: string[]) {
  const key = [...alertIds].sort();
  return queryOptions({
    queryKey: ["iq", "alert-events", key],
    enabled: alertIds.length > 0,
    queryFn: () =>
      run<AlertEvent[]>(
        scoped("alert_events", ALERT_EVENT_COLUMNS)
          .in("alert_id", alertIds)
          .order("created_at", { ascending: false }),
        "iq.alert_events",
      ),
  });
}

/**
 * Moves an alert to a new status and records the transition in the immutable
 * alert history so reviewers can audit who acted and when.
 */
export async function reviewAlert(input: {
  alertId: string;
  fromStatus: AlertStatus;
  toStatus: AlertStatus;
  note?: string;
}) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const actor = await currentActor();

  const patch: Record<string, unknown> = { status: input.toStatus };
  if (input.toStatus === "acknowledged") {
    patch.acknowledged_at = new Date().toISOString();
    patch.acknowledged_by = actor.id;
  }

  let update = raw.from("alerts").update(patch).eq("id", input.alertId);
  update = update.eq("company_id", company);
  const { error } = await update;
  if (error) throw new Error(error.message);

  const { error: eventError } = await raw.from("alert_events").insert({
    company_id: company,
    alert_id: input.alertId,
    actor_id: actor.id,
    actor_name: actor.name,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    note: input.note?.trim() ? input.note.trim() : null,
  });
  if (eventError) throw new Error(eventError.message);
}
