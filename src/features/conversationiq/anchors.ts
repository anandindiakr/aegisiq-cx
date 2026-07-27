import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant } from "@/features/platform/queries";

/**
 * Transcript anchors — saved highlights that pin a note or labels to a
 * specific speaker and time range inside a conversation transcript.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

export interface TranscriptAnchor {
  id: string;
  conversation_id: string;
  transcript_id: string | null;
  speaker: string;
  start_ms: number;
  end_ms: number;
  quote: string;
  note: string | null;
  labels: string[];
  author_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const ANCHOR_COLUMNS =
  "id,conversation_id,transcript_id,speaker,start_ms,end_ms,quote,note,labels,author_name,created_by,created_at,updated_at";

async function currentActor() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const meta = (user?.user_metadata ?? {}) as { full_name?: string };
  return { id: user?.id ?? null, name: meta.full_name ?? user?.email ?? "Unknown reviewer" };
}

export function transcriptAnchorsQuery(conversationId: string) {
  return queryOptions({
    queryKey: ["iq", "anchors", conversationId],
    queryFn: () =>
      traced("iq.transcript_anchors", async () => {
        const company = getActiveTenant();
        let builder = raw
          .from("transcript_anchors")
          .select(ANCHOR_COLUMNS)
          .eq("conversation_id", conversationId)
          .order("start_ms");
        if (company) builder = builder.eq("company_id", company);
        const { data, error } = await builder;
        if (error) throw new Error(error.message);
        return (data ?? []) as TranscriptAnchor[];
      }),
  });
}

export async function createTranscriptAnchor(input: {
  conversationId: string;
  transcriptId?: string | null;
  speaker: string;
  startMs: number;
  endMs: number;
  quote: string;
  note?: string;
  labels?: string[];
}) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const actor = await currentActor();
  const { error } = await raw.from("transcript_anchors").insert({
    company_id: company,
    conversation_id: input.conversationId,
    transcript_id: input.transcriptId ?? null,
    speaker: input.speaker,
    start_ms: Math.max(0, Math.round(input.startMs)),
    end_ms: Math.max(0, Math.round(input.endMs)),
    quote: input.quote.slice(0, 2000),
    note: input.note?.trim() ? input.note.trim() : null,
    labels: (input.labels ?? []).map((l) => l.trim().toLowerCase()).filter(Boolean),
    created_by: actor.id,
    author_name: actor.name,
  });
  if (error) throw new Error(error.message);
}

export async function updateTranscriptAnchor(
  id: string,
  patch: {
    note?: string | null;
    labels?: string[];
    speaker?: string;
    startMs?: number;
    endMs?: number;
    quote?: string;
  },
) {
  const company = getActiveTenant();
  const body: Record<string, unknown> = {};
  if (patch.note !== undefined) body.note = patch.note?.trim() ? patch.note.trim() : null;
  if (patch.labels) body.labels = patch.labels.map((l) => l.trim().toLowerCase()).filter(Boolean);
  if (patch.speaker !== undefined) body.speaker = patch.speaker.trim();
  if (patch.startMs !== undefined) body.start_ms = Math.max(0, Math.round(patch.startMs));
  if (patch.endMs !== undefined) body.end_ms = Math.max(0, Math.round(patch.endMs));
  if (patch.quote !== undefined) body.quote = patch.quote.slice(0, 2000);
  if (
    body.start_ms !== undefined &&
    body.end_ms !== undefined &&
    (body.end_ms as number) < (body.start_ms as number)
  ) {
    throw new Error("The anchor end time must be after its start time.");
  }
  let query = raw.from("transcript_anchors").update(body).eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteTranscriptAnchor(id: string) {
  const company = getActiveTenant();
  let query = raw.from("transcript_anchors").delete().eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}
