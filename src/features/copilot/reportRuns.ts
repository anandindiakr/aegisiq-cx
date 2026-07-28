/**
 * "My Executive Reports" — history of every streamed Copilot report run.
 *
 * A run row is created the moment a report starts and finalised when it
 * completes, partially completes or fails. It keeps the section-level state
 * and the finished answer card so the executive can reopen the streamed output
 * later, resume a failed run from its last successful section, or re-run it.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import { traced } from "@/lib/observability";
import type { CopilotReportPartial, CopilotResponse } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export type ReportRunStatus = "running" | "completed" | "partial" | "failed" | "cancelled";

export interface CopilotReportRun {
  id: string;
  company_id: string;
  user_id: string;
  command: string;
  intent: string;
  input_mode: string;
  range_label: string | null;
  filters: Record<string, unknown>;
  status: ReportRunStatus;
  sections: CopilotReportPartial["sections"];
  partial: Partial<CopilotReportPartial>;
  response: CopilotResponse | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

export const REPORT_RUN_STATUS_LABELS: Record<ReportRunStatus, string> = {
  running: "Running",
  completed: "Completed",
  partial: "Partially completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Newest first — the history page is personal, RLS scopes it to the caller. */
export const copilotReportRunsQuery = queryOptions({
  queryKey: ["copilot", "report-runs"],
  queryFn: () =>
    traced("copilot.reportRuns.list", async () => {
      const { data, error } = await table("copilot_report_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as CopilotReportRun[];
    }),
  staleTime: 15_000,
});

export interface StartRunInput {
  command: string;
  intent: string;
  inputMode: string;
  rangeLabel: string;
  filters: Record<string, unknown>;
}

/** Never throws: report history must not break the report itself. */
export async function startReportRun(input: StartRunInput): Promise<string | null> {
  try {
    const companyId = getActiveTenant();
    const { data: auth } = await supabase.auth.getUser();
    if (!companyId || !auth.user?.id) return null;
    const { data, error } = await table("copilot_report_runs")
      .insert({
        company_id: companyId,
        user_id: auth.user.id,
        command: input.command.slice(0, 500),
        intent: input.intent,
        input_mode: input.inputMode,
        range_label: input.rangeLabel,
        filters: input.filters,
        status: "running",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return (data as { id: string }).id;
  } catch (error) {
    console.warn("copilot report run start failed", error);
    return null;
  }
}

export interface FinishRunInput {
  status: ReportRunStatus;
  response?: CopilotResponse;
  partial?: CopilotReportPartial;
  errorMessage?: string;
  durationMs: number;
}

export async function finishReportRun(id: string, input: FinishRunInput): Promise<void> {
  try {
    await table("copilot_report_runs")
      .update({
        status: input.status,
        sections: input.partial?.sections ?? [],
        partial: input.partial ?? {},
        response: input.response ?? null,
        error_message: input.errorMessage ?? null,
        completed_at: new Date().toISOString(),
        duration_ms: input.durationMs,
      })
      .eq("id", id);
  } catch (error) {
    console.warn("copilot report run finish failed", error);
  }
}

/** True when at least one section still needs producing. */
export function isResumable(run: CopilotReportRun): boolean {
  if (run.status === "failed" || run.status === "cancelled" || run.status === "running")
    return true;
  return (run.sections ?? []).some((s) => s.status === "failed" || s.status === "skipped");
}

/**
 * Checkpoint written while the report streams so a refresh, a crashed tab or a
 * dropped connection leaves a resumable record behind instead of a dead run.
 */
export async function checkpointReportRun(
  id: string,
  partial: CopilotReportPartial,
): Promise<void> {
  try {
    await table("copilot_report_runs").update({ sections: partial.sections, partial }).eq("id", id);
  } catch (error) {
    console.warn("copilot report run checkpoint failed", error);
  }
}

/**
 * A run still marked "running" but untouched for a while belongs to a session
 * that went away (refresh, closed tab, lost connection). The provider picks the
 * newest one up on load and continues from its last successful section.
 */
export async function findInterruptedRun(staleAfterMs = 20_000): Promise<CopilotReportRun | null> {
  try {
    const { data, error } = await table("copilot_report_runs")
      .select("*")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const run = (data ?? [])[0] as CopilotReportRun | undefined;
    if (!run) return null;
    const touched = new Date(run.started_at).getTime();
    return Date.now() - touched > staleAfterMs ? run : null;
  } catch (error) {
    console.warn("copilot interrupted run lookup failed", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Artifacts — the files and deliveries a run produced
// ---------------------------------------------------------------------------

export type ArtifactKind = "export" | "delivery";

export interface CopilotReportArtifact {
  id: string;
  run_id: string;
  kind: ArtifactKind;
  format: string | null;
  filename: string | null;
  channel: string | null;
  destination: string | null;
  status: string;
  size_bytes: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const reportArtifactsQuery = queryOptions({
  queryKey: ["copilot", "report-artifacts"],
  queryFn: () =>
    traced("copilot.reportArtifacts.list", async () => {
      const { data, error } = await table("copilot_report_artifacts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw new Error(error.message);
      return (data ?? []) as CopilotReportArtifact[];
    }),
  staleTime: 15_000,
});

export interface ArtifactInput {
  runId: string;
  kind: ArtifactKind;
  format?: string;
  filename?: string;
  channel?: string;
  destination?: string;
  status?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/** Never throws: bookkeeping must not break the export it describes. */
export async function recordReportArtifact(input: ArtifactInput): Promise<void> {
  try {
    const companyId = getActiveTenant();
    const { data: auth } = await supabase.auth.getUser();
    if (!companyId || !auth.user?.id) return;
    await table("copilot_report_artifacts").insert({
      company_id: companyId,
      user_id: auth.user.id,
      run_id: input.runId,
      kind: input.kind,
      format: input.format ?? null,
      filename: input.filename ?? null,
      channel: input.channel ?? null,
      destination: input.destination ?? null,
      status: input.status ?? "ready",
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.warn("copilot report artifact record failed", error);
  }
}
