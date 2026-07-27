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
const ALERT_EVENT_COLUMNS = "id,alert_id,actor_id,actor_name,from_status,to_status,note,created_at";

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

// --- Bulk review -----------------------------------------------------------

export type BulkAction = "acknowledged" | "resolved" | "dismissed";

/** Conversation status applied alongside each bulk alert transition. */
const CONVERSATION_STATUS: Record<BulkAction, string> = {
  acknowledged: "in_review",
  resolved: "resolved",
  dismissed: "closed",
};

/**
 * Applies an acknowledge / resolve / dismiss decision to every alert linked to
 * the selected conversations, records each transition in the alert history and
 * moves the conversations themselves to the matching review status.
 *
 * The caller's filters, sorting and pagination are untouched — only the data
 * behind them changes, so the list re-renders in place.
 */
export async function bulkReviewConversations(input: {
  conversationIds: string[];
  action: BulkAction;
  note?: string;
}) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  if (input.conversationIds.length === 0) throw new Error("Select at least one conversation.");
  const actor = await currentActor();
  const note = input.note?.trim() ? input.note.trim() : null;

  let alertsUpdated = 0;
  const chunkSize = 80;

  for (let i = 0; i < input.conversationIds.length; i += chunkSize) {
    const chunk = input.conversationIds.slice(i, i + chunkSize);

    const alerts = await run<{ id: string; status: AlertStatus }[]>(
      scoped("alerts", "id,status").in("conversation_id", chunk).neq("status", input.action),
      "iq.bulk_alerts",
    );

    if (alerts.length > 0) {
      const patch: Record<string, unknown> = { status: input.action };
      if (input.action === "acknowledged") {
        patch.acknowledged_at = new Date().toISOString();
        patch.acknowledged_by = actor.id;
      }
      const { error } = await raw
        .from("alerts")
        .update(patch)
        .eq("company_id", company)
        .in(
          "id",
          alerts.map((a) => a.id),
        );
      if (error) throw new Error(error.message);

      const { error: eventError } = await raw.from("alert_events").insert(
        alerts.map((alert) => ({
          company_id: company,
          alert_id: alert.id,
          actor_id: actor.id,
          actor_name: actor.name,
          from_status: alert.status,
          to_status: input.action,
          note,
        })),
      );
      if (eventError) throw new Error(eventError.message);
      alertsUpdated += alerts.length;
    }

    const { error: convError } = await raw
      .from("conversations")
      .update({ status: CONVERSATION_STATUS[input.action] })
      .eq("company_id", company)
      .in("id", chunk);
    if (convError) throw new Error(convError.message);
  }

  return { conversations: input.conversationIds.length, alerts: alertsUpdated };
}

// --- Review search ---------------------------------------------------------

export interface ReviewSearchHit {
  conversationId: string;
  kind: "note" | "tag" | "anchor";
  text: string;
  detail: string | null;
  author: string | null;
  createdAt: string;
}

/**
 * Full-text search across internal review notes, review tags and saved
 * transcript anchors so a reviewer can find a previously reviewed case by what
 * the team wrote about it rather than by conversation metadata.
 */
export function reviewSearchQuery(term: string) {
  const trimmed = term.trim();
  return queryOptions({
    queryKey: ["iq", "review-search", trimmed.toLowerCase()],
    enabled: trimmed.length >= 2,
    queryFn: async (): Promise<ReviewSearchHit[]> => {
      const websearch = trimmed
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
        .filter(Boolean)
        .join(" & ");
      const like = `%${trimmed.replace(/[%_]/g, "")}%`;

      const [notes, tags, anchors] = await Promise.all([
        run<ConversationNote[]>(
          websearch
            ? scoped("conversation_notes", NOTE_COLUMNS)
                .textSearch("body", websearch, { type: "plain", config: "english" })
                .order("created_at", { ascending: false })
                .limit(100)
            : scoped("conversation_notes", NOTE_COLUMNS)
                .ilike("body", like)
                .order("created_at", { ascending: false })
                .limit(100),
          "iq.search_notes",
        ).catch(() =>
          run<ConversationNote[]>(
            scoped("conversation_notes", NOTE_COLUMNS)
              .ilike("body", like)
              .order("created_at", { ascending: false })
              .limit(100),
            "iq.search_notes_fallback",
          ),
        ),
        run<ConversationTag[]>(
          scoped("conversation_tags", TAG_COLUMNS)
            .ilike("tag", like)
            .order("created_at", { ascending: false })
            .limit(200),
          "iq.search_tags",
        ),
        run<
          {
            id: string;
            conversation_id: string;
            quote: string;
            note: string | null;
            speaker: string;
            author_name: string | null;
            created_at: string;
          }[]
        >(
          scoped(
            "transcript_anchors",
            "id,conversation_id,quote,note,speaker,author_name,created_at",
          )
            .or(`quote.ilike.${like},note.ilike.${like}`)
            .order("created_at", { ascending: false })
            .limit(100),
          "iq.search_anchors",
        ),
      ]);

      return [
        ...notes.map(
          (n): ReviewSearchHit => ({
            conversationId: n.conversation_id,
            kind: "note",
            text: n.body,
            detail: null,
            author: n.author_name,
            createdAt: n.created_at,
          }),
        ),
        ...tags.map(
          (t): ReviewSearchHit => ({
            conversationId: t.conversation_id,
            kind: "tag",
            text: t.tag,
            detail: null,
            author: null,
            createdAt: t.created_at,
          }),
        ),
        ...anchors.map(
          (a): ReviewSearchHit => ({
            conversationId: a.conversation_id,
            kind: "anchor",
            text: a.quote,
            detail: a.note,
            author: a.author_name,
            createdAt: a.created_at,
          }),
        ),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  });
}
