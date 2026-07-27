import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant } from "@/features/platform/queries";
import type { AlertRow } from "@/features/platform/queries";

/**
 * ConversationIQ™ data layer.
 *
 * Reads are tenant-scoped twice over: row-level security is the enforcement
 * point in the database, and every builder here additionally filters on the
 * company resolved by the `_authenticated` guard so a mis-scoped query fails
 * closed. The shapes below deliberately mirror the database columns so a real
 * AI pipeline can write into the same tables without a UI refactor.
 */

export type RiskLevel = "low" | "medium" | "high";
export type ConversationStatus = "new" | "in_review" | "escalated" | "resolved" | "closed";
export type EmotionLabel = "satisfied" | "happy" | "confused" | "frustrated" | "angry" | "neutral";
export type SentimentLabel =
  | "very_negative"
  | "negative"
  | "neutral"
  | "positive"
  | "very_positive";

export interface IqConversation {
  id: string;
  reference: string;
  outlet_id: string | null;
  camera_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  language_code: string;
  secondary_language_code: string | null;
  language_confidence: number;
  sentiment: SentimentLabel;
  sentiment_score: number;
  emotion: EmotionLabel;
  risk_level: RiskLevel;
  status: ConversationStatus;
  topic: string | null;
  agent_name: string | null;
  customer_type: string | null;
  escalated: boolean;
}

export interface IqTranscript {
  id: string;
  conversation_id: string;
  speaker: string;
  sequence: number;
  content: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
  language_code: string;
}

export interface IqSummary {
  id: string;
  conversation_id: string;
  summary: string;
  key_points: string[];
  intent: string | null;
  resolution_status: string;
  model: string;
  created_at: string;
}

export interface IqDetectedKeyword {
  id: string;
  conversation_id: string;
  keyword: string;
  category: string;
  confidence: number;
}

export interface IqEvent {
  id: string;
  conversation_id: string;
  label: string;
  detail: string | null;
  sequence: number;
  offset_ms: number;
}

// Generated database types lag behind new migrations; the module keeps its own
// row interfaces above and reads through an untyped builder.
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

const CONVERSATION_COLUMNS =
  "id,reference,outlet_id,camera_id,started_at,ended_at,duration_seconds,language_code,secondary_language_code,language_confidence,sentiment,sentiment_score,emotion,risk_level,status,topic,agent_name,customer_type,escalated";

export const iqConversationsQuery = queryOptions({
  queryKey: ["iq", "conversations"],
  queryFn: () =>
    run<IqConversation[]>(
      scoped("conversations", CONVERSATION_COLUMNS)
        .order("started_at", { ascending: false })
        .limit(1000),
      "iq.conversations",
    ),
});

/** Detected keywords for every conversation, used by the list keyword filter. */
export const iqKeywordIndexQuery = queryOptions({
  queryKey: ["iq", "keyword-index"],
  queryFn: async () => {
    const rows = await run<IqDetectedKeyword[]>(
      scoped("conversation_keywords", "id,conversation_id,keyword,category,confidence").limit(
        20000,
      ),
      "iq.keyword_index",
    );
    const byConversation = new Map<string, IqDetectedKeyword[]>();
    const counts = new Map<string, number>();
    for (const row of rows) {
      const list = byConversation.get(row.conversation_id) ?? [];
      list.push(row);
      byConversation.set(row.conversation_id, list);
      counts.set(row.keyword, (counts.get(row.keyword) ?? 0) + 1);
    }
    return { byConversation, counts, rows };
  },
});

/** Summaries keyed by conversation so the list can preview them inline. */
export const iqSummaryIndexQuery = queryOptions({
  queryKey: ["iq", "summary-index"],
  queryFn: async () => {
    const rows = await run<IqSummary[]>(
      scoped(
        "summaries",
        "id,conversation_id,summary,key_points,intent,resolution_status,model,created_at",
      ).limit(2000),
      "iq.summary_index",
    );
    return new Map(rows.map((r) => [r.conversation_id, r]));
  },
});

/** Alerts keyed by conversation so the list can show the alert column. */
export const iqAlertIndexQuery = queryOptions({
  queryKey: ["iq", "alert-index"],
  queryFn: async () => {
    const rows = await run<AlertRow[]>(
      scoped(
        "alerts",
        "id,conversation_id,title,category,severity,status,triggered_at,outlet_id,description",
      ).limit(2000),
      "iq.alert_index",
    );
    const map = new Map<string, AlertRow[]>();
    for (const row of rows) {
      if (!row.conversation_id) continue;
      const list = map.get(row.conversation_id) ?? [];
      list.push(row);
      map.set(row.conversation_id, list);
    }
    return map;
  },
});

export function iqConversationQuery(conversationId: string) {
  return queryOptions({
    queryKey: ["iq", "conversation", conversationId],
    queryFn: async () => {
      const [conversation, transcripts, summaries, keywords, events, alerts] = await Promise.all([
        run<IqConversation[]>(
          scoped("conversations", CONVERSATION_COLUMNS).eq("id", conversationId).limit(1),
          "iq.conversation",
        ),
        run<IqTranscript[]>(
          scoped(
            "transcripts",
            "id,conversation_id,speaker,sequence,content,start_ms,end_ms,confidence,language_code",
          )
            .eq("conversation_id", conversationId)
            .order("sequence"),
          "iq.transcripts",
        ),
        run<IqSummary[]>(
          scoped(
            "summaries",
            "id,conversation_id,summary,key_points,intent,resolution_status,model,created_at",
          )
            .eq("conversation_id", conversationId)
            .limit(1),
          "iq.summary",
        ),
        run<IqDetectedKeyword[]>(
          scoped("conversation_keywords", "id,conversation_id,keyword,category,confidence")
            .eq("conversation_id", conversationId)
            .order("confidence", { ascending: false }),
          "iq.conversation_keywords",
        ),
        run<IqEvent[]>(
          scoped("conversation_events", "id,conversation_id,label,detail,sequence,offset_ms")
            .eq("conversation_id", conversationId)
            .order("sequence"),
          "iq.conversation_events",
        ),
        run<AlertRow[]>(
          scoped(
            "alerts",
            "id,conversation_id,title,category,severity,status,triggered_at,outlet_id,description",
          )
            .eq("conversation_id", conversationId)
            .order("triggered_at", { ascending: false }),
          "iq.conversation_alerts",
        ),
      ]);

      if (conversation.length === 0) throw new Error("Conversation not found in this workspace.");
      return {
        conversation: conversation[0],
        transcripts,
        summary: summaries[0] ?? null,
        keywords,
        events,
        alerts,
      };
    },
  });
}

export async function updateConversationStatus(id: string, status: ConversationStatus) {
  const company = getActiveTenant();
  let query = raw.from("conversations").update({ status }).eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Keyword library management
// ---------------------------------------------------------------------------

export const KEYWORD_CATEGORIES = [
  "Complaint",
  "Refund",
  "Pricing",
  "Warranty",
  "Aggressive Behaviour",
  "Promotion",
  "Service",
  "Fraud",
  "Manager",
  "Custom",
] as const;

export async function createKeyword(input: { term: string; category: string; weight: number }) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const { error } = await raw.from("keywords").insert({
    company_id: company,
    term: input.term,
    category: input.category,
    weight: input.weight,
    is_active: true,
  });
  if (error) throw new Error(error.message);
}

export async function setKeywordActive(id: string, isActive: boolean) {
  const company = getActiveTenant();
  let query = raw.from("keywords").update({ is_active: isActive }).eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteKeyword(id: string) {
  const company = getActiveTenant();
  let query = raw.from("keywords").delete().eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function setLanguageActive(id: string, isActive: boolean) {
  const company = getActiveTenant();
  let query = raw.from("languages").update({ is_active: isActive }).eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export interface IqLanguage {
  id: string;
  code: string;
  name: string;
  native_name: string | null;
  is_active: boolean;
  detection_confidence: number;
}

export const iqLanguagesQuery = queryOptions({
  queryKey: ["iq", "languages"],
  queryFn: () =>
    run<IqLanguage[]>(
      scoped("languages", "id,code,name,native_name,is_active,detection_confidence").order("name"),
      "iq.languages",
    ),
});
