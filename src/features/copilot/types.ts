/**
 * Aegis Copilot™ — shared contracts.
 *
 * The copilot is a deterministic command resolver over the tenant's live
 * analytics, with an optional AI layer for transcript-level work. Everything
 * a command can produce is described here so the UI, the audit trail and the
 * speech layer all speak the same language.
 */
import type { ExportFormat } from "@/features/command-centre/export";

export type CopilotInputMode = "text" | "voice";

export type CopilotIntent =
  | "executive_report"
  | "export_report"
  | "open_alerts"
  | "compare_regions"
  | "outlet_ranking"
  | "sentiment_overview"
  | "language_mix"
  | "top_keywords"
  | "open_queue"
  | "open_conversations"
  | "open_dashboard"
  | "summarise_conversation"
  | "translate_conversation"
  | "explain_sentiment"
  | "related_conversations"
  | "set_favorite_outlet"
  | "pin_dashboard"
  | "help"
  | "unknown";

export type CopilotOutcome =
  | "answered"
  | "navigated"
  | "exported"
  | "denied"
  | "failed"
  | "clarify"
  | "preview";

/** One-tap chip that chains a related command without retyping. */
export interface CopilotFollowUp {
  label: string;
  command: string;
  hint?: string;
}

export interface CopilotClarificationOption {
  label: string;
  hint?: string;
  /** Command re-issued when the executive picks this option. */
  command: string;
}

/** Asked when the resolver cannot confidently bind an entity or a choice. */
export interface CopilotClarification {
  question: string;
  field: "outlet" | "region" | "employee" | "format" | "dashboard";
  options: CopilotClarificationOption[];
}

/** One parameter shown in a dry-run preview before anything is executed. */
export interface CopilotPreviewParam {
  label: string;
  value: string;
}

/**
 * Dry run: what *would* happen if the command executed. Nothing is exported,
 * delivered or written until the executive confirms.
 */
export interface CopilotPreview {
  kind: "export" | "delivery";
  summary: string;
  parameters: CopilotPreviewParam[];
  confirmLabel: string;
  /** Command re-issued (pre-confirmed) when the executive approves. */
  confirmCommand: string;
}

export type CopilotReportSectionStatus = "pending" | "running" | "ok" | "failed" | "skipped";

/** One stage of a streamed executive report. */
export interface CopilotReportSection {
  key: string;
  label: string;
  status: CopilotReportSectionStatus;
  attempts: number;
  error?: string;
}

/** Everything produced so far — lets a failed run resume where it stopped. */
export interface CopilotReportPartial {
  sections: CopilotReportSection[];
  metrics: CopilotMetric[];
  body: string[];
  chart?: { title: string; points: CopilotChartPoint[] };
}

/** Progress emitted while a long-running answer streams in. */
export interface CopilotProgress {
  label: string;
  percent: number;
  done?: boolean;
  /** True once at least one section failed after its retries. */
  failed?: boolean;
  sections?: CopilotReportSection[];
}

export interface CopilotLink {
  label: string;
  to: string;
  search?: Record<string, unknown>;
  params?: Record<string, string>;
}

export interface CopilotMetric {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "danger";
}

export interface CopilotChartPoint {
  label: string;
  value: number;
}

export interface CopilotResponse {
  intent: CopilotIntent;
  title: string;
  body: string[];
  metrics: CopilotMetric[];
  chart?: { title: string; points: CopilotChartPoint[] };
  links: CopilotLink[];
  /** Navigation the copilot performs immediately on the user's behalf. */
  autoNavigate?: CopilotLink;
  /** Board-pack export the copilot triggers immediately. */
  exportFormat?: ExportFormat;
  tone: "default" | "warning" | "danger";
  outcome: CopilotOutcome;
  deniedReason?: string;
  /** Entities the resolver bound the command to — mirrored into the audit log. */
  entities: CopilotEntities;
  /** One-tap chips to chain the next likely command. */
  followUps?: CopilotFollowUp[];
  /** Set when the copilot needs a decision before it can execute. */
  clarification?: CopilotClarification;
  /** Set when the command was dry run and awaits confirmation. */
  preview?: CopilotPreview;
  /** Section-level state of a streamed executive report (for resume). */
  report?: CopilotReportPartial;
  /** Row id in the executive report history, once persisted. */
  runId?: string;

  /** Live progress while the answer is still streaming. */
  progress?: CopilotProgress;
}

export interface CopilotEntities {
  outletId?: string;
  outletName?: string;
  region?: string;
  employee?: string;
  language?: string;
  keyword?: string;
  conversationId?: string;
  reference?: string;
  format?: string;
  dashboard?: string;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode: CopilotInputMode;
  createdAt: string;
  response?: CopilotResponse;
  pending?: boolean;
}

/** What the copilot is "looking at" — set by the surface that mounts it. */
export interface CopilotSurfaceContext {
  surface: string;
  label?: string;
  conversationId?: string;
  reference?: string;
  outletId?: string;
  outletName?: string;
  language?: string;
}
