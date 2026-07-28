/**
 * Aegis Copilot™ usage audit trail.
 *
 * Every command — typed or spoken — is written to `copilot_audit_events`,
 * including the entities the resolver bound to and any access-denied outcome.
 * The table is append-only: no UPDATE or DELETE grant exists.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant } from "@/features/platform/queries";
import type { CopilotEntities, CopilotInputMode, CopilotIntent, CopilotOutcome } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export interface CopilotAuditEvent {
  id: string;
  company_id: string;
  actor_id: string | null;
  actor_name: string | null;
  command: string;
  intent: string;
  input_mode: CopilotInputMode;
  surface: string;
  route: string | null;
  resolved_entities: CopilotEntities;
  outcome: CopilotOutcome;
  denied_reason: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface LogCopilotEventInput {
  command: string;
  intent: CopilotIntent;
  inputMode: CopilotInputMode;
  surface: string;
  route?: string;
  entities?: CopilotEntities;
  outcome: CopilotOutcome;
  deniedReason?: string;
  durationMs?: number;
  actorName?: string | null;
}

/** Fire-and-forget: copilot answers must never fail because logging failed. */
export async function logCopilotEvent(input: LogCopilotEventInput) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    const row: Record<string, unknown> = {
      actor_id: userId,
      actor_name: input.actorName ?? auth.user?.email ?? null,
      command: input.command.slice(0, 500),
      intent: input.intent,
      input_mode: input.inputMode,
      surface: input.surface,
      route: input.route ?? null,
      resolved_entities: input.entities ?? {},
      outcome: input.outcome,
      denied_reason: input.deniedReason ?? null,
      duration_ms: input.durationMs ?? null,
    };
    const companyId = getActiveTenant();
    if (companyId) row.company_id = companyId;
    await table("copilot_audit_events").insert(row);
  } catch (error) {
    console.warn("copilot audit log failed", error);
  }
}

export interface CopilotAuditFilters {
  search: string;
  /** Tenant (company) the events belong to — "all" for every tenant in scope. */
  tenant: string;
  /** Actor name or id filter. */
  actor: string;
  intent: string;
  mode: string;
  outcome: string;
  page: number;
  pageSize: number;
}

export const DEFAULT_COPILOT_AUDIT_FILTERS: CopilotAuditFilters = {
  search: "",
  tenant: "all",
  actor: "all",
  intent: "all",
  mode: "all",
  outcome: "all",
  page: 0,
  pageSize: 25,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(builder: any, filters: CopilotAuditFilters) {
  let query = builder;
  if (filters.tenant !== "all") query = query.eq("company_id", filters.tenant);
  if (filters.actor !== "all") query = query.eq("actor_name", filters.actor);
  if (filters.intent !== "all") query = query.eq("intent", filters.intent);
  if (filters.mode !== "all") query = query.eq("input_mode", filters.mode);
  if (filters.outcome !== "all") query = query.eq("outcome", filters.outcome);
  if (filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`command.ilike.${term},actor_name.ilike.${term}`);
  }
  return query;
}

/** Distinct tenants and actors present in the trail — powers the filter bar. */
export const copilotAuditFacetsQuery = queryOptions({
  queryKey: ["copilot", "audit", "facets"],
  queryFn: () =>
    traced("copilot.audit.facets", async () => {
      const { data, error } = await table("copilot_audit_events")
        .select("company_id, actor_name")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { company_id: string; actor_name: string | null }[];
      const tenants = [...new Set(rows.map((r) => r.company_id).filter(Boolean))];
      const actors = [...new Set(rows.map((r) => r.actor_name).filter(Boolean))] as string[];
      return { tenants, actors: actors.sort((a, b) => a.localeCompare(b)) };
    }),
});

/** Every row matching the filters (capped), for CSV/PDF compliance exports. */
export async function fetchCopilotAuditRows(
  filters: CopilotAuditFilters,
  limit = 5000,
): Promise<CopilotAuditEvent[]> {
  const builder = table("copilot_audit_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  const { data, error } = await applyFilters(builder, filters);
  if (error) throw new Error(error.message);
  return (data ?? []) as CopilotAuditEvent[];
}

export function copilotAuditQuery(filters: CopilotAuditFilters) {
  return queryOptions({
    queryKey: ["copilot", "audit", filters],
    queryFn: () =>
      traced("copilot.audit", async () => {
        const builder = applyFilters(
          table("copilot_audit_events")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false }),
          filters,
        );

        const from = filters.page * filters.pageSize;
        const { data, error, count } = await builder.range(from, from + filters.pageSize - 1);
        if (error) throw new Error(error.message);
        return { rows: (data ?? []) as CopilotAuditEvent[], total: count ?? 0 };
      }),
  });
}

function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCopilotAuditCsv(rows: CopilotAuditEvent[]): string {
  const header = [
    "Timestamp",
    "Actor",
    "Command",
    "Intent",
    "Input mode",
    "Surface",
    "Route",
    "Outcome",
    "Denied reason",
    "Entities",
    "Duration (ms)",
  ];
  const body = rows.map((row) =>
    [
      row.created_at,
      row.actor_name ?? row.actor_id ?? "",
      row.command,
      row.intent,
      row.input_mode,
      row.surface,
      row.route ?? "",
      row.outcome,
      row.denied_reason ?? "",
      JSON.stringify(row.resolved_entities ?? {}),
      row.duration_ms ?? "",
    ]
      .map(cell)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

export const COPILOT_INTENTS: string[] = [
  "executive_report",
  "export_report",
  "open_alerts",
  "compare_regions",
  "outlet_ranking",
  "sentiment_overview",
  "language_mix",
  "top_keywords",
  "open_queue",
  "open_conversations",
  "open_dashboard",
  "summarise_conversation",
  "translate_conversation",
  "explain_sentiment",
  "related_conversations",
  "set_favorite_outlet",
  "pin_dashboard",
  "help",
  "unknown",
];

export const COPILOT_OUTCOMES: CopilotOutcome[] = [
  "answered",
  "navigated",
  "exported",
  "denied",
  "failed",
];

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function filterSummary(filters: CopilotAuditFilters): string {
  const parts = [
    filters.tenant === "all" ? "All tenants" : `Tenant ${filters.tenant}`,
    filters.actor === "all" ? "All users" : `User ${filters.actor}`,
    filters.intent === "all" ? "All command types" : `Command ${filters.intent.replace(/_/g, " ")}`,
    filters.mode === "all" ? "Text and voice" : `${filters.mode} input`,
    filters.outcome === "all" ? "All outcomes" : `Outcome ${filters.outcome}`,
  ];
  if (filters.search.trim()) parts.push(`Search “${filters.search.trim()}”`);
  return parts.join(" · ");
}

/**
 * Opens a print-ready compliance document for the filtered trail. Browsers
 * print or "Save as PDF" from here — no server round-trip, no third party.
 */
export function openCopilotAuditPdf(rows: CopilotAuditEvent[], filters: CopilotAuditFilters) {
  const generated = new Date().toLocaleString();
  const body = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(new Date(row.created_at).toLocaleString())}</td>
        <td>${escapeHtml(row.actor_name ?? row.actor_id ?? "—")}</td>
        <td>${escapeHtml(row.command)}</td>
        <td>${escapeHtml(row.intent.replace(/_/g, " "))}</td>
        <td>${escapeHtml(row.input_mode)}</td>
        <td>${escapeHtml(
          Object.entries(row.resolved_entities ?? {})
            .filter(([, value]) => value !== null && value !== undefined && value !== "")
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join(" · ") || "—",
        )}</td>
        <td>${escapeHtml(row.outcome)}${row.denied_reason ? ` — ${escapeHtml(row.denied_reason)}` : ""}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" />
    <title>AegisIQ CX — Copilot audit</title>
    <style>
      body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #101418; margin: 32px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      p.meta { color: #5b6570; font-size: 11px; margin: 0 0 18px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th { text-align: left; background: #f1f4f7; padding: 6px; border-bottom: 1px solid #d7dde3; }
      td { padding: 6px; border-bottom: 1px solid #eef1f4; vertical-align: top; }
      tr { break-inside: avoid; }
      @page { size: A4 landscape; margin: 12mm; }
    </style></head><body>
    <h1>Aegis Copilot™ audit trail</h1>
    <p class="meta">${escapeHtml(rows.length)} events · ${escapeHtml(filterSummary(filters))} · generated ${escapeHtml(generated)}</p>
    <table><thead><tr>
      <th>When</th><th>Actor</th><th>Command</th><th>Intent</th><th>Mode</th><th>Entities</th><th>Outcome</th>
    </tr></thead><tbody>${body}</tbody></table>
    <script>window.onload = () => window.print();</script>
  </body></html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!win) throw new Error("Allow pop-ups to produce the PDF document.");
  win.document.write(html);
  win.document.close();
}
