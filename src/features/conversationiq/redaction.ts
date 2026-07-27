import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant } from "@/features/platform/queries";

/**
 * Transcript redaction.
 *
 * A redaction marks a character range of a single utterance as sensitive. The
 * original text stays in the database for compliance, but the viewer masks it
 * for anyone without the "reveal" capability, and exports honour the tenant's
 * configured behaviour (mask, reveal for admins, or block the export).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

export type RedactionCategory = "pii" | "payment" | "health" | "credential" | "other";

export const REDACTION_CATEGORIES: RedactionCategory[] = [
  "pii",
  "payment",
  "health",
  "credential",
  "other",
];

export const REDACTION_CATEGORY_LABELS: Record<RedactionCategory, string> = {
  pii: "Personal data",
  payment: "Payment details",
  health: "Health information",
  credential: "Credentials",
  other: "Other sensitive",
};

export type RedactionExportMode = "masked" | "unmasked_for_admins" | "blocked";

export const EXPORT_MODE_LABELS: Record<RedactionExportMode, string> = {
  masked: "Always mask redacted text in exports",
  unmasked_for_admins: "Reveal to workspace admins in exports",
  blocked: "Block exports that contain redacted segments",
};

export interface TranscriptRedaction {
  id: string;
  conversation_id: string;
  transcript_id: string | null;
  start_offset: number;
  end_offset: number;
  category: RedactionCategory;
  label: string;
  reason: string | null;
  original_snippet: string | null;
  author_name: string | null;
  created_at: string;
}

const COLUMNS =
  "id,conversation_id,transcript_id,start_offset,end_offset,category,label,reason,original_snippet,author_name,created_at";

export function redactionsQuery(conversationId: string) {
  return queryOptions({
    queryKey: ["iq", "redactions", conversationId],
    queryFn: () =>
      traced("iq.redactions", async () => {
        const company = getActiveTenant();
        let builder = raw
          .from("transcript_redactions")
          .select(COLUMNS)
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });
        if (company) builder = builder.eq("company_id", company);
        const { data, error } = await builder;
        if (error) throw new Error(error.message);
        return (data ?? []) as TranscriptRedaction[];
      }),
  });
}

export interface RedactionInput {
  conversationId: string;
  transcriptId: string;
  startOffset: number;
  endOffset: number;
  category: RedactionCategory;
  label: string;
  reason?: string;
  originalSnippet: string;
}

async function actorName() {
  const { data } = await supabase.auth.getUser();
  const meta = (data.user?.user_metadata ?? {}) as { full_name?: string };
  return {
    id: data.user?.id ?? null,
    name: meta.full_name ?? data.user?.email ?? "Reviewer",
  };
}

export async function createRedaction(input: RedactionInput) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const actor = await actorName();
  const { error } = await raw.from("transcript_redactions").insert({
    company_id: company,
    conversation_id: input.conversationId,
    transcript_id: input.transcriptId,
    start_offset: input.startOffset,
    end_offset: input.endOffset,
    category: input.category,
    label: input.label.trim().slice(0, 80) || "Redacted",
    reason: input.reason?.trim() || null,
    original_snippet: input.originalSnippet,
    created_by: actor.id,
    author_name: actor.name,
  });
  if (error) throw new Error(error.message);
}

export async function updateRedaction(
  id: string,
  patch: { category?: RedactionCategory; label?: string; reason?: string | null },
) {
  const company = getActiveTenant();
  const body: Record<string, unknown> = {};
  if (patch.category) body.category = patch.category;
  if (patch.label !== undefined) body.label = patch.label.trim().slice(0, 80) || "Redacted";
  if (patch.reason !== undefined) body.reason = patch.reason?.trim() || null;
  let query = raw.from("transcript_redactions").update(body).eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteRedaction(id: string) {
  const company = getActiveTenant();
  let query = raw.from("transcript_redactions").delete().eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export function maskToken(redaction: Pick<TranscriptRedaction, "label" | "category">) {
  return `[${redaction.label || REDACTION_CATEGORY_LABELS[redaction.category]}]`;
}

/**
 * Applies redactions to a single utterance. Ranges are clamped and merged so
 * overlapping marks never produce broken output.
 */
export function applyRedactions(
  content: string,
  redactions: TranscriptRedaction[],
  reveal: boolean,
) {
  if (reveal || redactions.length === 0) return content;
  const ranges = redactions
    .map((r) => ({
      start: Math.max(0, Math.min(r.start_offset, content.length)),
      end: Math.max(0, Math.min(r.end_offset, content.length)),
      token: maskToken(r),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  if (ranges.length === 0) return content;

  let out = "";
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    out += content.slice(cursor, range.start) + range.token;
    cursor = range.end;
  }
  return out + content.slice(cursor);
}

/** Fetches every redaction for a set of conversations (used by exports). */
export async function fetchRedactionsFor(conversationIds: string[]) {
  const company = getActiveTenant();
  const out: TranscriptRedaction[] = [];
  for (let i = 0; i < conversationIds.length; i += 80) {
    const chunk = conversationIds.slice(i, i + 80);
    let builder = raw.from("transcript_redactions").select(COLUMNS).in("conversation_id", chunk);
    if (company) builder = builder.eq("company_id", company);
    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as TranscriptRedaction[]));
  }
  return out;
}

export interface RedactionExportPolicy {
  mode: RedactionExportMode;
  canReveal: boolean;
}

/** Decides how an export should treat redacted text, or refuses it outright. */
export function resolveExportBehaviour(policy: RedactionExportPolicy) {
  if (policy.mode === "blocked") return { blocked: true, reveal: false } as const;
  if (policy.mode === "unmasked_for_admins" && policy.canReveal) {
    return { blocked: false, reveal: true } as const;
  }
  return { blocked: false, reveal: false } as const;
}

/** Groups redactions by the transcript line they belong to. */
export function byTranscript(redactions: TranscriptRedaction[]) {
  const map = new Map<string, TranscriptRedaction[]>();
  for (const item of redactions) {
    if (!item.transcript_id) continue;
    const list = map.get(item.transcript_id) ?? [];
    list.push(item);
    map.set(item.transcript_id, list);
  }
  return map;
}

/** Every redaction in the workspace, newest first (governance registry). */
export const allRedactionsQuery = queryOptions({
  queryKey: ["iq", "redactions", "all"],
  queryFn: () =>
    traced("iq.redactions_all", async () => {
      const company = getActiveTenant();
      let builder = raw
        .from("transcript_redactions")
        .select(COLUMNS)
        .order("created_at", { ascending: false })
        .limit(500);
      if (company) builder = builder.eq("company_id", company);
      const { data, error } = await builder;
      if (error) throw new Error(error.message);
      return (data ?? []) as TranscriptRedaction[];
    }),
});

/** Tenant-wide export behaviour for redacted segments. */
export async function setRedactionExportMode(mode: RedactionExportMode) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const { error } = await raw
    .from("companies")
    .update({ redaction_export_mode: mode })
    .eq("id", company);
  if (error) throw new Error(error.message);
}
