import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant } from "@/features/platform/queries";
import type { Camera, Outlet, AlertRow } from "@/features/platform/queries";
import { formatDate } from "@/lib/format";
import { languageName } from "@/components/conversationiq/Badges";
import type {
  IqConversation,
  IqDetectedKeyword,
  IqSummary,
  IqTranscript,
} from "@/features/conversationiq/queries";

/**
 * Deep CSV export for ConversationIQ™.
 *
 * The list only holds conversation-level rows, so a full export re-fetches the
 * transcript and detected keywords for exactly the conversations the operator
 * selected (or, with nothing selected, everything the current filters and
 * search left on screen). Requests are chunked so large exports stay within
 * PostgREST URL limits.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchScoped<T>(
  table: string,
  columns: string,
  ids: string[],
  op: string,
): Promise<T[]> {
  const company = getActiveTenant();
  const results: T[] = [];
  for (const batch of chunk(ids, 80)) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await traced(op, async () => {
      let query = raw.from(table).select(columns).in("conversation_id", batch);
      if (company) query = query.eq("company_id", company);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as T[];
    });
    results.push(...rows);
  }
  return results;
}

function offsetLabel(ms: number) {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)
    .toString()
    .padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

export interface DeepExportContext {
  outlets: Map<string, Outlet>;
  cameras: Map<string, Camera>;
  summaries: Map<string, IqSummary>;
  alerts: Map<string, AlertRow[]>;
  tags?: Map<string, string[]>;
}

/**
 * Builds and downloads a CSV containing one row per conversation, with the
 * complete diarised transcript and detected keyword list inlined.
 */
export async function exportConversationsDeepCsv(
  rows: IqConversation[],
  ctx: DeepExportContext,
): Promise<number> {
  if (rows.length === 0) return 0;
  const ids = rows.map((r) => r.id);

  const [transcripts, keywords] = await Promise.all([
    fetchScoped<IqTranscript>(
      "transcripts",
      "id,conversation_id,speaker,sequence,content,start_ms,end_ms,confidence,language_code",
      ids,
      "iq.export_transcripts",
    ),
    fetchScoped<IqDetectedKeyword>(
      "conversation_keywords",
      "id,conversation_id,keyword,category,confidence",
      ids,
      "iq.export_keywords",
    ),
  ]);

  const transcriptsBy = new Map<string, IqTranscript[]>();
  for (const line of transcripts) {
    const list = transcriptsBy.get(line.conversation_id) ?? [];
    list.push(line);
    transcriptsBy.set(line.conversation_id, list);
  }
  for (const list of transcriptsBy.values()) list.sort((a, b) => a.sequence - b.sequence);

  const keywordsBy = new Map<string, IqDetectedKeyword[]>();
  for (const keyword of keywords) {
    const list = keywordsBy.get(keyword.conversation_id) ?? [];
    list.push(keyword);
    keywordsBy.set(keyword.conversation_id, list);
  }

  const header = [
    "Conversation ID",
    "Outlet",
    "Camera",
    "Date",
    "Start time",
    "Duration (s)",
    "Language",
    "Secondary language",
    "Sentiment",
    "Sentiment score",
    "Emotion",
    "Risk",
    "Status",
    "Escalated",
    "Employee",
    "Topic",
    "Alerts",
    "Review tags",
    "AI summary",
    "Key points",
    "Detected keywords",
    "Speakers",
    "Transcript",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    const lineItems = transcriptsBy.get(row.id) ?? [];
    const detected = keywordsBy.get(row.id) ?? [];
    const summary = ctx.summaries.get(row.id);
    const alerts = ctx.alerts.get(row.id) ?? [];
    const speakers = Array.from(new Set(lineItems.map((l) => l.speaker)));

    lines.push(
      [
        row.reference,
        ctx.outlets.get(row.outlet_id ?? "")?.name ?? "",
        ctx.cameras.get(row.camera_id ?? "")?.name ?? "",
        formatDate(row.started_at),
        new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(
          new Date(row.started_at),
        ),
        String(row.duration_seconds),
        languageName(row.language_code),
        row.secondary_language_code ? languageName(row.secondary_language_code) : "",
        row.sentiment,
        String(row.sentiment_score),
        row.emotion,
        row.risk_level,
        row.status,
        row.escalated ? "yes" : "no",
        row.agent_name ?? "",
        row.topic ?? "",
        alerts.map((a) => `${a.title} (${a.severity}/${a.status})`).join(" | "),
        (ctx.tags?.get(row.id) ?? []).join(" | "),
        summary?.summary ?? "",
        (summary?.key_points ?? []).join(" | "),
        detected.map((k) => `${k.keyword} [${k.category}]`).join(" | "),
        speakers.join(" | "),
        lineItems
          .map((l) => `[${offsetLabel(l.start_ms)}] ${l.speaker}: ${l.content}`)
          .join("\n"),
      ]
        .map(escape)
        .join(","),
    );
  }

  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `conversationiq-full-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  return rows.length;
}
