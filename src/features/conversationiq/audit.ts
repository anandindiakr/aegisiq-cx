import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant } from "@/features/platform/queries";

/**
 * Immutable compliance trail for ConversationIQ™. Rows are written by database
 * triggers on `conversations` and `review_assignments`; the app can only read
 * them — there is no insert, update or delete path from the client.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

export type AuditEntityType = "conversation" | "review_assignment";

export interface ReviewAuditEvent {
  id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  conversation_id: string | null;
  assignment_id: string | null;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  changed_fields: string[];
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  created_at: string;
}

const AUDIT_COLUMNS =
  "id,entity_type,entity_id,conversation_id,assignment_id,action,actor_id,actor_name,changed_fields,before_state,after_state,created_at";

export interface AuditFilters {
  entityType?: AuditEntityType | "all";
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}

function build(filters: AuditFilters) {
  const company = getActiveTenant();
  let builder = raw
    .from("review_audit_events")
    .select(AUDIT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 500);
  if (company) builder = builder.eq("company_id", company);
  if (filters.entityType && filters.entityType !== "all") {
    builder = builder.eq("entity_type", filters.entityType);
  }
  if (filters.action && filters.action !== "all") builder = builder.eq("action", filters.action);
  if (filters.actor && filters.actor !== "all") builder = builder.eq("actor_id", filters.actor);
  if (filters.from) builder = builder.gte("created_at", filters.from);
  if (filters.to) builder = builder.lte("created_at", filters.to);
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    builder = builder.or(`actor_name.ilike.${term},action.ilike.${term}`);
  }
  return builder;
}

export function reviewAuditQuery(filters: AuditFilters) {
  return queryOptions({
    queryKey: ["iq", "audit", filters],
    queryFn: () =>
      traced("iq.review_audit", async () => {
        const { data, error } = await build(filters);
        if (error) throw new Error(error.message);
        return (data ?? []) as ReviewAuditEvent[];
      }),
  });
}

/** Trail scoped to a single conversation, including its queue items. */
export function conversationAuditQuery(conversationId: string) {
  return queryOptions({
    queryKey: ["iq", "audit", "conversation", conversationId],
    queryFn: () =>
      traced("iq.review_audit_conversation", async () => {
        const company = getActiveTenant();
        let builder = raw
          .from("review_audit_events")
          .select(AUDIT_COLUMNS)
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(200);
        if (company) builder = builder.eq("company_id", company);
        const { data, error } = await builder;
        if (error) throw new Error(error.message);
        return (data ?? []) as ReviewAuditEvent[];
      }),
  });
}

export async function fetchAuditForExport(filters: AuditFilters) {
  const { data, error } = await build({ ...filters, limit: 10_000 });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReviewAuditEvent[];
}

function csvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** Compliance-friendly CSV: one row per recorded change, oldest last. */
export function toAuditCsv(rows: ReviewAuditEvent[]) {
  const header = [
    "event_id",
    "recorded_at",
    "entity_type",
    "entity_id",
    "conversation_id",
    "action",
    "actor_name",
    "actor_id",
    "changed_fields",
    "before_state",
    "after_state",
  ];
  const lines = rows.map((row) =>
    [
      row.id,
      row.created_at,
      row.entity_type,
      row.entity_id,
      row.conversation_id ?? "",
      row.action,
      row.actor_name ?? "System",
      row.actor_id ?? "",
      row.changed_fields.join(" "),
      row.before_state,
      row.after_state,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([`\uFEFF${contents}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Human sentence for a recorded change, used in timelines and lists. */
export function describeAuditEvent(event: ReviewAuditEvent) {
  const entity = event.entity_type === "conversation" ? "Conversation" : "Queue item";
  if (event.action === "created") return `${entity} created`;
  if (event.action === "removed") return `${entity} removed from the queue`;
  const parts = event.changed_fields.map((field) => {
    const before = event.before_state[field];
    const after = event.after_state[field];
    const label = field.replace(/_/g, " ");
    if (field === "assignee_id") {
      return `assignee ${String(event.before_state.assignee_name ?? "unassigned")} → ${String(
        event.after_state.assignee_name ?? "unassigned",
      )}`;
    }
    return `${label} ${String(before ?? "—")} → ${String(after ?? "—")}`;
  });
  return `${entity} ${parts.join(", ")}`;
}
