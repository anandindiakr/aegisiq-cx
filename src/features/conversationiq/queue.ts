import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant } from "@/features/platform/queries";

/**
 * Reviewer queue — assignable work items with status and SLA tracking so a
 * review team can share out alerts and conversations without losing sight of
 * what is due.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

export type QueueStatus = "open" | "in_progress" | "done" | "cancelled";
export type QueuePriority = "low" | "normal" | "high" | "urgent";

export const QUEUE_STATUSES: QueueStatus[] = ["open", "in_progress", "done", "cancelled"];
export const QUEUE_PRIORITIES: QueuePriority[] = ["low", "normal", "high", "urgent"];

/** Default service-level target per priority, in minutes. */
export const SLA_PRESETS: Record<QueuePriority, number> = {
  urgent: 60,
  high: 120,
  normal: 240,
  low: 1440,
};

export interface ReviewAssignment {
  id: string;
  conversation_id: string | null;
  alert_id: string | null;
  title: string;
  assignee_id: string | null;
  assignee_name: string | null;
  status: QueueStatus;
  priority: QueuePriority;
  sla_minutes: number;
  due_at: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const QUEUE_COLUMNS =
  "id,conversation_id,alert_id,title,assignee_id,assignee_name,status,priority,sla_minutes,due_at,started_at,completed_at,notes,created_at,updated_at";

async function currentActor() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const meta = (user?.user_metadata ?? {}) as { full_name?: string };
  return { id: user?.id ?? null, name: meta.full_name ?? user?.email ?? "Unknown reviewer" };
}

export const reviewQueueQuery = queryOptions({
  queryKey: ["iq", "review-queue"],
  queryFn: () =>
    traced("iq.review_queue", async () => {
      const company = getActiveTenant();
      let builder = raw
        .from("review_assignments")
        .select(QUEUE_COLUMNS)
        .order("due_at", { ascending: true })
        .limit(2000);
      if (company) builder = builder.eq("company_id", company);
      const { data, error } = await builder;
      if (error) throw new Error(error.message);
      return (data ?? []) as ReviewAssignment[];
    }),
});

export function conversationQueueQuery(conversationId: string) {
  return queryOptions({
    queryKey: ["iq", "review-queue", "conversation", conversationId],
    queryFn: () =>
      traced("iq.review_queue_conversation", async () => {
        const company = getActiveTenant();
        let builder = raw
          .from("review_assignments")
          .select(QUEUE_COLUMNS)
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false });
        if (company) builder = builder.eq("company_id", company);
        const { data, error } = await builder;
        if (error) throw new Error(error.message);
        return (data ?? []) as ReviewAssignment[];
      }),
  });
}

export interface CreateAssignmentInput {
  conversationId?: string | null;
  alertId?: string | null;
  title: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  priority?: QueuePriority;
  slaMinutes?: number;
  notes?: string;
}

export async function createAssignment(input: CreateAssignmentInput) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const actor = await currentActor();
  const priority = input.priority ?? "normal";
  const sla = input.slaMinutes ?? SLA_PRESETS[priority];
  const { error } = await raw.from("review_assignments").insert({
    company_id: company,
    conversation_id: input.conversationId ?? null,
    alert_id: input.alertId ?? null,
    title: input.title.slice(0, 300),
    assignee_id: input.assigneeId ?? null,
    assignee_name: input.assigneeName ?? null,
    priority,
    sla_minutes: sla,
    due_at: new Date(Date.now() + sla * 60_000).toISOString(),
    notes: input.notes?.trim() ? input.notes.trim() : null,
    created_by: actor.id,
  });
  if (error) {
    throw new Error(
      error.message.includes("duplicate")
        ? "That alert is already in the reviewer queue."
        : error.message,
    );
  }
}

/** Creates queue items in bulk, ignoring alerts that are already queued. */
export async function createAssignments(items: CreateAssignmentInput[]) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const actor = await currentActor();
  const rows = items.map((input) => {
    const priority = input.priority ?? "normal";
    const sla = input.slaMinutes ?? SLA_PRESETS[priority];
    return {
      company_id: company,
      conversation_id: input.conversationId ?? null,
      alert_id: input.alertId ?? null,
      title: input.title.slice(0, 300),
      assignee_id: input.assigneeId ?? null,
      assignee_name: input.assigneeName ?? null,
      priority,
      sla_minutes: sla,
      due_at: new Date(Date.now() + sla * 60_000).toISOString(),
      notes: input.notes?.trim() ? input.notes.trim() : null,
      created_by: actor.id,
    };
  });
  if (rows.length === 0) return 0;
  const { data, error } = await raw
    .from("review_assignments")
    .upsert(rows, { onConflict: "alert_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string }[]).length;
}

export async function updateAssignment(
  id: string,
  patch: {
    status?: QueueStatus;
    priority?: QueuePriority;
    assigneeId?: string | null;
    assigneeName?: string | null;
    slaMinutes?: number;
    notes?: string | null;
  },
) {
  const company = getActiveTenant();
  const body: Record<string, unknown> = {};
  if (patch.status) {
    body.status = patch.status;
    if (patch.status === "in_progress") body.started_at = new Date().toISOString();
    if (patch.status === "done" || patch.status === "cancelled") {
      body.completed_at = new Date().toISOString();
    }
    if (patch.status === "open") {
      body.started_at = null;
      body.completed_at = null;
    }
  }
  if (patch.priority) body.priority = patch.priority;
  if (patch.assigneeId !== undefined) body.assignee_id = patch.assigneeId;
  if (patch.assigneeName !== undefined) body.assignee_name = patch.assigneeName;
  if (patch.slaMinutes !== undefined) {
    body.sla_minutes = patch.slaMinutes;
    body.due_at = new Date(Date.now() + patch.slaMinutes * 60_000).toISOString();
  }
  if (patch.notes !== undefined) body.notes = patch.notes;

  let query = raw.from("review_assignments").update(body).eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteAssignment(id: string) {
  const company = getActiveTenant();
  let query = raw.from("review_assignments").delete().eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

/** Remaining SLA in minutes; negative when the item has breached. */
export function slaMinutesLeft(item: ReviewAssignment, now = Date.now()) {
  const reference = item.completed_at ? new Date(item.completed_at).getTime() : now;
  return Math.round((new Date(item.due_at).getTime() - reference) / 60_000);
}

export type SlaState = "met" | "due_soon" | "breached" | "closed";

export function slaState(item: ReviewAssignment, now = Date.now()): SlaState {
  const left = slaMinutesLeft(item, now);
  if (item.status === "cancelled") return "closed";
  if (item.status === "done") return left >= 0 ? "met" : "breached";
  if (left < 0) return "breached";
  if (left <= Math.max(15, item.sla_minutes * 0.25)) return "due_soon";
  return "met";
}

export function formatSla(minutes: number) {
  const abs = Math.abs(minutes);
  const label = abs >= 60 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${abs}m`;
  return minutes < 0 ? `${label} over` : `${label} left`;
}

/** Applies the same patch to many queue items, chunked to keep URLs short. */
export async function bulkUpdateAssignments(
  ids: string[],
  patch: Parameters<typeof updateAssignment>[1],
) {
  let updated = 0;
  for (const id of ids) {
    await updateAssignment(id, patch);
    updated += 1;
  }
  return updated;
}

/** Queue items linked to the given conversations (used by bulk actions). */
export async function assignmentsForConversations(conversationIds: string[]) {
  if (conversationIds.length === 0) return [] as ReviewAssignment[];
  const company = getActiveTenant();
  const out: ReviewAssignment[] = [];
  for (let i = 0; i < conversationIds.length; i += 80) {
    const chunk = conversationIds.slice(i, i + 80);
    let builder = raw.from("review_assignments").select(QUEUE_COLUMNS).in("conversation_id", chunk);
    if (company) builder = builder.eq("company_id", company);
    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as ReviewAssignment[]));
  }
  return out;
}

export interface BulkQueuePatch {
  status?: QueueStatus;
  priority?: QueuePriority;
  assigneeId?: string | null;
  assigneeName?: string | null;
  slaMinutes?: number;
}

/**
 * Bulk assign or move conversations between queue states. Conversations that
 * are not queued yet are enqueued first, so a single action always lands.
 */
export async function bulkQueueConversations(
  conversationIds: string[],
  patch: BulkQueuePatch,
  titles?: Map<string, string>,
) {
  if (conversationIds.length === 0) return { updated: 0, created: 0 };
  const existing = await assignmentsForConversations(conversationIds);
  const queued = new Set(existing.map((item) => item.conversation_id));
  const missing = conversationIds.filter((id) => !queued.has(id));

  let created = 0;
  if (missing.length > 0) {
    created = await createAssignments(
      missing.map((id) => ({
        conversationId: id,
        title: titles?.get(id) ?? "Review conversation",
        assigneeId: patch.assigneeId ?? null,
        assigneeName: patch.assigneeName ?? null,
        priority: patch.priority ?? "normal",
        slaMinutes: patch.slaMinutes,
      })),
    );
  }

  const targets = existing.filter((item) => item.status !== "cancelled" || patch.status);
  const updated = await bulkUpdateAssignments(
    targets.map((item) => item.id),
    patch,
  );
  return { updated, created };
}
