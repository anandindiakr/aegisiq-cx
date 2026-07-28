/**
 * Aegis Copilot™ intelligence engine.
 *
 * A deterministic resolver: natural language (typed or spoken) is mapped to an
 * intent, executed against live tenant data, and returned as a structured
 * answer card plus optional side effects (navigation, export, AI analysis).
 * No command ever touches another tenant's data — every read goes through the
 * existing row-level-security-scoped query layer.
 */
import type { QueryClient } from "@tanstack/react-query";

import { formatCompact, formatDuration, formatNumber } from "@/lib/format";
import { executiveOverviewQuery } from "@/features/command-centre/queries";
import type { CommandFilters } from "@/features/command-centre/filters";
import { rangeLabel } from "@/features/command-centre/filters";
import type { ExportFormat } from "@/features/command-centre/export";
import {
  cxBand,
  cxScore,
  executiveBriefing,
  recommendations,
} from "@/features/command-centre/insights";
import type { ExecutiveOverview } from "@/features/command-centre/types";
import { iqConversationQuery, iqConversationsQuery } from "@/features/conversationiq/queries";
import { analyseTranscript } from "@/lib/copilot.functions";
import { DASHBOARD_TARGETS } from "./catalog";
import type { CopilotPreferences } from "./preferences";
import type {
  CopilotFollowUp,
  CopilotIntent,
  CopilotMetric,
  CopilotReportPartial,
  CopilotReportSection,
  CopilotResponse,
  CopilotSurfaceContext,
} from "./types";

export interface ResolveOptions {
  text: string;
  queryClient: QueryClient;
  context: CopilotSurfaceContext | null;
  filters: CommandFilters;
  prefs: CopilotPreferences | null;
  canExport: boolean;
  canViewTranscripts: boolean;
  /** Streaming hook — partial answers are pushed here while work continues. */
  onPartial?: (partial: CopilotResponse) => void;
  /** Set when the executive already approved a dry-run preview. */
  confirmed?: boolean;
  /** Previous partial report — completed sections are reused, not recomputed. */
  resume?: CopilotReportPartial;
  /** Aborts a streaming run; the partial produced so far stays resumable. */
  signal?: AbortSignal;
}

/** Thrown when the executive stops a streaming run from the dock. */
export class CopilotCancelled extends Error {
  readonly partial?: CopilotReportPartial;
  constructor(partial?: CopilotReportPartial) {
    super("Report cancelled");
    this.name = "CopilotCancelled";
    this.partial = partial;
  }
}

const INTENT_RULES: { intent: CopilotIntent; patterns: RegExp[] }[] = [
  { intent: "export_report", patterns: [/\bexport\b/, /\bdownload\b/, /\bboard pack\b/] },
  {
    intent: "executive_report",
    patterns: [/executive (report|summary|brief)/, /generate report/, /brief me/],
  },
  { intent: "open_alerts", patterns: [/\balerts?\b/, /escalations? list/] },
  { intent: "compare_regions", patterns: [/compare regions?/, /\bregions?\b/, /by region/] },
  {
    intent: "outlet_ranking",
    patterns: [/outlet (ranking|performance)/, /best outlet/, /worst outlet/, /\boutlets?\b/],
  },
  { intent: "sentiment_overview", patterns: [/sentiment/, /\bmood\b/, /\bcsat\b/] },
  { intent: "language_mix", patterns: [/languages?/, /translation mix/] },
  { intent: "top_keywords", patterns: [/keywords?/, /\bterms?\b/, /topics? mentioned/] },
  { intent: "open_queue", patterns: [/queue/, /reviewers?/, /\bsla\b/] },
  { intent: "summarise_conversation", patterns: [/summari[sz]e/, /\btl;?dr\b/, /key points/] },
  { intent: "translate_conversation", patterns: [/translate/, /in english/] },
  {
    intent: "explain_sentiment",
    patterns: [/why .*(negative|positive|angry|upset)/, /explain (the )?sentiment/],
  },
  {
    intent: "related_conversations",
    patterns: [/related conversations?/, /similar conversations?/],
  },
  { intent: "pin_dashboard", patterns: [/pin (this )?dashboard/, /pin \w+/] },
  { intent: "set_favorite_outlet", patterns: [/favou?rite outlet/, /default outlet/] },
  { intent: "open_conversations", patterns: [/conversations?/, /conversationiq/, /transcripts?/] },
  { intent: "open_dashboard", patterns: [/dashboard/, /command cent(re|er)/, /go to/, /\bopen\b/] },
  { intent: "help", patterns: [/help/, /what can you do/, /commands?/] },
];

export function detectIntent(text: string, context: CopilotSurfaceContext | null): CopilotIntent {
  const value = text.toLowerCase().trim();
  if (!value) return "unknown";
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(value))) {
      // Conversation-scoped verbs only make sense with a target loaded.
      const needsConversation =
        rule.intent === "summarise_conversation" ||
        rule.intent === "translate_conversation" ||
        rule.intent === "explain_sentiment" ||
        rule.intent === "related_conversations";
      if (needsConversation && !context?.conversationId) {
        if (rule.intent === "related_conversations") return "open_conversations";
        continue;
      }
      return rule.intent;
    }
  }
  return "unknown";
}

function detectFormat(text: string): ExportFormat {
  const value = text.toLowerCase();
  if (value.includes("excel") || value.includes("xls")) return "excel";
  if (value.includes("csv")) return "csv";
  if (value.includes("deck") || value.includes("powerpoint") || value.includes("ppt"))
    return "powerpoint";
  return "pdf";
}

/** True when the command names an export format explicitly. */
function hasExplicitFormat(text: string): boolean {
  return /\b(pdf|excel|xls[x]?|csv|deck|powerpoint|ppt[x]?|spreadsheet|slides?)\b/i.test(text);
}

function base(intent: CopilotIntent, title: string): CopilotResponse {
  return {
    intent,
    title,
    body: [],
    metrics: [],
    links: [],
    tone: "default",
    outcome: "answered",
    entities: {},
  };
}

function pct(value: number, total: number) {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";
}

function kpiMetrics(overview: ExecutiveOverview): CopilotMetric[] {
  const k = overview.kpis;
  return [
    { label: "Conversations", value: formatCompact(k.total) },
    {
      label: "Positive",
      value: pct(k.positive, k.total),
      tone: "positive",
    },
    {
      label: "Negative",
      value: pct(k.negative, k.total),
      tone: k.negative / Math.max(k.total, 1) > 0.25 ? "danger" : "default",
    },
    {
      label: "Escalations",
      value: formatNumber(k.escalations),
      tone: k.escalations > 0 ? "warning" : "default",
    },
    { label: "Open alerts", value: formatNumber(k.alerts) },
    { label: "Avg handling", value: formatDuration(Math.round(k.avg_duration)) },
  ];
}

async function overviewFor(opts: ResolveOptions) {
  return opts.queryClient.ensureQueryData(executiveOverviewQuery(opts.filters));
}

async function transcriptFor(opts: ResolveOptions, conversationId: string) {
  const detail = await opts.queryClient.ensureQueryData(iqConversationQuery(conversationId));
  const transcript = detail.transcripts
    .map((line) => `${line.speaker}: ${line.content}`)
    .join("\n");
  return { detail, transcript };
}

// ---------------------------------------------------------------------------
// Dry run
// ---------------------------------------------------------------------------

/** Prefix the confirm chip prepends so the engine skips the preview step. */
export const CONFIRM_PREFIX = "confirm: ";
const CONFIRM_RE = /^(confirm|yes,? ?(run|do) it|approved)\s*[:,-]?\s*/i;

/** Strips the confirmation prefix, reporting whether it was present. */
export function stripConfirmation(text: string): { text: string; confirmed: boolean } {
  const match = CONFIRM_RE.exec(text);
  if (!match) return { text, confirmed: false };
  const rest = text.slice(match[0].length).trim();
  return rest ? { text: rest, confirmed: true } : { text, confirmed: false };
}

function previewParameters(
  opts: ResolveOptions,
  format: ExportFormat,
  overview: ExecutiveOverview,
): { label: string; value: string }[] {
  const f = opts.filters;
  const list = (values: string[], fallback: string) =>
    values.length > 0 ? values.join(", ") : fallback;
  return [
    { label: "Format", value: format.toUpperCase() },
    { label: "Period", value: rangeLabel(f) },
    {
      label: "Outlets",
      value: opts.context?.outletName ?? list(f.outlets, "All outlets"),
    },
    { label: "Regions", value: list(f.regions, "All regions") },
    { label: "Languages", value: list(f.languages, "All languages") },
    { label: "Conversations", value: formatNumber(overview.kpis.total) },
    { label: "Delivery", value: "Download to this device" },
  ];
}

// ---------------------------------------------------------------------------
// Executive report — streamed, retried, resumable
// ---------------------------------------------------------------------------

const REPORT_SECTIONS = [
  { key: "snapshot", label: "Collecting tenant snapshot", percent: 20 },
  { key: "score", label: "Scoring customer experience", percent: 40 },
  { key: "briefing", label: "Writing the executive briefing", percent: 60 },
  { key: "chart", label: "Charting the trend", percent: 80 },
  { key: "recommendations", label: "Drafting recommendations", percent: 100 },
] as const;

async function withRetry<T>(
  run: () => Promise<T>,
  attempts = 2,
): Promise<{ value: T; tries: number }> {
  let lastError: unknown;
  for (let tryIndex = 1; tryIndex <= attempts; tryIndex += 1) {
    try {
      return { value: await run(), tries: tryIndex };
    } catch (error) {
      lastError = error;
      if (tryIndex < attempts) await new Promise((resolve) => setTimeout(resolve, 400 * tryIndex));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Section failed");
}

/**
 * Produces the executive report section by section. Each section retries once
 * before it is marked failed; the run continues with the sections that can
 * still be produced, and the partial state is returned so a later command can
 * resume from the last successful section instead of starting over.
 */
async function runExecutiveReport(opts: ResolveOptions): Promise<CopilotResponse> {
  const response = base("executive_report", `Executive report — ${rangeLabel(opts.filters)}`);
  const prior = opts.resume;
  const sections: CopilotReportSection[] = REPORT_SECTIONS.map((section) => {
    const before = prior?.sections.find((s) => s.key === section.key);
    return {
      key: section.key,
      label: section.label,
      status: before?.status === "ok" ? "ok" : "pending",
      attempts: before?.attempts ?? 0,
    };
  });

  if (prior) {
    response.metrics = [...prior.metrics];
    response.body = [...prior.body];
    if (prior.chart) response.chart = prior.chart;
  }

  const emit = (label: string, percent: number, done = false) => {
    response.progress = {
      label,
      percent,
      done,
      failed: sections.some((s) => s.status === "failed"),
      sections: sections.map((s) => ({ ...s })),
    };
    opts.onPartial?.({
      ...response,
      body: [...response.body],
      metrics: [...response.metrics],
      progress: response.progress,
    });
  };

  let overview: ExecutiveOverview | null = null;

  const work: Record<string, () => Promise<void>> = {
    snapshot: async () => {
      overview = await overviewFor(opts);
    },
    score: async () => {
      if (!overview) throw new Error("Snapshot unavailable");
      const score = cxScore(overview);
      const band = cxBand(score);
      response.metrics = [
        { label: "CX score", value: `${score}`, hint: band.label },
        ...kpiMetrics(overview),
      ];
      response.tone = score < 50 ? "danger" : score < 65 ? "warning" : "default";
    },
    briefing: async () => {
      if (!overview) throw new Error("Snapshot unavailable");
      response.body = executiveBriefing(overview);
    },
    chart: async () => {
      if (!overview) throw new Error("Snapshot unavailable");
      response.chart = {
        title: "Daily conversation volume",
        points: overview.daily
          .slice(-14)
          .map((d) => ({ label: d.day.slice(5), value: d.conversations })),
      };
    },
    recommendations: async () => {
      if (!overview) throw new Error("Snapshot unavailable");
      const recs = recommendations(overview).slice(0, 3);
      if (recs.length > 0) response.body.push(...recs.map((r) => `**${r.title}** — ${r.detail}`));
    },
  };

  for (const definition of REPORT_SECTIONS) {
    if (opts.signal?.aborted) {
      throw new CopilotCancelled({
        sections: sections.map((s) => ({ ...s })),
        metrics: [...response.metrics],
        body: [...response.body],
        chart: response.chart,
      });
    }
    const state = sections.find((s) => s.key === definition.key)!;
    // Resume: a section already produced in an earlier run is reused as-is.
    if (state.status === "ok" && definition.key !== "snapshot") {
      emit(`${definition.label} (reused)`, definition.percent);
      continue;
    }
    if (definition.key !== "snapshot" && !overview) {
      state.status = "skipped";
      state.error = "Skipped — tenant snapshot unavailable";
      emit(`${definition.label} skipped`, definition.percent);
      continue;
    }
    state.status = "running";
    emit(`${definition.label}…`, Math.max(definition.percent - 12, 5));
    try {
      const { tries } = await withRetry(work[definition.key]);
      state.status = "ok";
      state.attempts += tries;
      delete state.error;
      emit(definition.label, definition.percent);
    } catch (error) {
      state.status = "failed";
      state.attempts += 2;
      state.error = error instanceof Error ? error.message : "Section failed";
      emit(`${definition.label} failed — continuing`, definition.percent);
    }
  }

  const failed = sections.filter((s) => s.status === "failed" || s.status === "skipped");
  response.links = [
    { label: "Open Command Centre", to: "/command-centre" },
    { label: "My executive reports", to: "/copilot/reports" },
  ];
  response.report = {
    sections,
    metrics: [...response.metrics],
    body: [...response.body],
    chart: response.chart,
  };

  if (failed.length > 0) {
    response.tone = "warning";
    response.body.push(
      `**${failed.length} section${failed.length === 1 ? "" : "s"} incomplete** — ${failed
        .map((s) => s.label)
        .join(", ")}. Everything else is final; resume to retry only what failed.`,
    );
    response.progress = {
      label: `Completed with ${failed.length} failed section${failed.length === 1 ? "" : "s"}`,
      percent: 100,
      done: true,
      failed: true,
      sections: sections.map((s) => ({ ...s })),
    };
  } else {
    response.progress = {
      label: "Report complete",
      percent: 100,
      done: true,
      sections: sections.map((s) => ({ ...s })),
    };
  }
  return response;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

async function resolveIntent(opts: ResolveOptions): Promise<CopilotResponse> {
  const intent = detectIntent(opts.text, opts.context);
  const ctx = opts.context;

  switch (intent) {
    case "executive_report":
      return runExecutiveReport(opts);

    case "export_report": {
      const format = detectFormat(opts.text);
      if (!opts.canExport) {
        const denied = base(intent, "Export blocked");
        denied.outcome = "denied";
        denied.tone = "danger";
        denied.deniedReason = "Your role cannot export executive reports.";
        denied.body = [
          "Board-pack exports are restricted to admins and regional managers. Request access from a workspace administrator.",
        ];
        denied.entities = { format };
        return denied;
      }
      if (!hasExplicitFormat(opts.text)) {
        // Confirmation step: never fire a board-pack export on a guessed format.
        const ask = base(intent, "Which format should I export?");
        ask.outcome = "clarify";
        ask.body = [
          `I can produce the board pack for ${rangeLabel(opts.filters)} in any of these formats.`,
        ];
        ask.clarification = {
          question: "Choose an export format to continue.",
          field: "format",
          options: [
            { label: "PDF board pack", command: `${opts.text} as PDF` },
            { label: "Excel workbook", command: `${opts.text} as Excel` },
            { label: "CSV data", command: `${opts.text} as CSV` },
            { label: "PowerPoint deck", command: `${opts.text} as PowerPoint deck` },
          ],
        };
        return ask;
      }
      const overview = await overviewFor(opts);

      if (!opts.confirmed) {
        // Dry run: show exactly what will be produced before anything leaves.
        const dry = base(intent, `Dry run — ${format.toUpperCase()} board pack`);
        dry.outcome = "preview";
        dry.entities = { format };
        dry.body = [
          "Nothing has been exported yet. Review the parameters below and confirm to execute.",
        ];
        dry.metrics = kpiMetrics(overview).slice(0, 3);
        dry.preview = {
          kind: "export",
          summary: `Board pack for ${rangeLabel(opts.filters)} across ${formatNumber(overview.kpis.total)} conversations.`,
          parameters: previewParameters(opts, format, overview),
          confirmLabel: `Export ${format.toUpperCase()}`,
          confirmCommand: `${CONFIRM_PREFIX}${opts.text}`,
        };
        return dry;
      }

      const response = base(intent, `Exporting board pack (${format.toUpperCase()})`);
      response.outcome = "exported";
      response.exportFormat = format;
      response.entities = { format };
      response.body = [
        `Generating the ${format.toUpperCase()} export for ${rangeLabel(opts.filters)} across ${formatNumber(overview.kpis.total)} conversations.`,
        "The export is audit logged and appears in your export history.",
      ];
      response.metrics = kpiMetrics(overview).slice(0, 3);
      response.links = [{ label: "Export history", to: "/reports" }];
      return response;
    }

    case "open_alerts": {
      const overview = await overviewFor(opts);
      const response = base(intent, "Live alerts");
      response.outcome = "navigated";
      response.autoNavigate = { label: "Alerts", to: "/alerts" };
      const bySeverity = overview.alertsBySeverity ?? {};
      response.metrics = Object.entries(bySeverity).map(([severity, count]) => ({
        label: severity,
        value: formatNumber(Number(count)),
        tone: severity === "critical" || severity === "high" ? "danger" : "default",
      }));
      response.body = [
        `${formatNumber(overview.kpis.alerts)} alerts triggered in ${rangeLabel(opts.filters)}. Taking you to the alert stream.`,
        ...overview.recentAlerts
          .slice(0, 4)
          .map((a) => `**${a.title}** — ${a.outlet_name ?? "Unassigned"} · ${a.severity}`),
      ];
      response.links = [
        { label: "Alerts", to: "/alerts" },
        { label: "Reviewer queue", to: "/conversationiq/queue" },
      ];
      response.tone = (bySeverity.critical ?? 0) > 0 ? "danger" : "default";
      return response;
    }

    case "compare_regions": {
      const overview = await overviewFor(opts);
      const regions = [...overview.regions].sort((a, b) => b.avg_sentiment - a.avg_sentiment);
      const response = base(intent, "Region comparison");
      response.chart = {
        title: "Conversations by region",
        points: regions.map((r) => ({ label: r.region, value: r.conversations })),
      };
      response.body = regions
        .slice(0, 5)
        .map(
          (r) =>
            `**${r.region}** — ${formatNumber(r.conversations)} conversations · sentiment ${r.avg_sentiment.toFixed(2)} · ${formatNumber(r.escalations)} escalations`,
        );
      if (regions.length > 1) {
        const best = regions[0];
        const worst = regions[regions.length - 1];
        response.metrics = [
          { label: "Strongest", value: best.region, tone: "positive" },
          { label: "Weakest", value: worst.region, tone: "danger" },
          {
            label: "Sentiment gap",
            value: (best.avg_sentiment - worst.avg_sentiment).toFixed(2),
          },
        ];
        response.entities = { region: worst.region };
        response.tone = worst.avg_sentiment < 0 ? "warning" : "default";
      }
      response.links = [{ label: "Open Command Centre", to: "/command-centre" }];
      return response;
    }

    case "outlet_ranking": {
      const overview = await overviewFor(opts);
      const ranked = [...overview.outlets].sort((a, b) => b.overall_score - a.overall_score);
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      const response = base(intent, "Outlet ranking");
      response.chart = {
        title: "Overall score (top 8)",
        points: ranked
          .slice(0, 8)
          .map((o) => ({ label: o.code || o.name, value: o.overall_score })),
      };
      response.body = ranked
        .slice(0, 5)
        .map(
          (o) =>
            `**${o.name}** — score ${o.overall_score} · ${formatNumber(o.conversations)} conversations · ${o.complaint_rate}% negative`,
        );
      if (best && worst) {
        response.metrics = [
          { label: "Top outlet", value: best.name, tone: "positive" },
          { label: "Needs attention", value: worst.name, tone: "danger" },
        ];
        response.entities = { outletId: worst.id, outletName: worst.name };
        response.links = [
          {
            label: `Investigate ${worst.name}`,
            to: "/conversationiq",
            search: { outletId: worst.id, from: "copilot" },
          },
          { label: "Outlet estate", to: "/outlets" },
        ];
      }
      return response;
    }

    case "sentiment_overview": {
      const overview = await overviewFor(opts);
      const response = base(intent, "Sentiment overview");
      response.chart = {
        title: "Average sentiment by period",
        points: overview.sentimentPeriods.map((p) => ({
          label: p.label,
          value: Number(p.avg_sentiment.toFixed(2)),
        })),
      };
      response.body = overview.sentimentPeriods.map(
        (p) =>
          `**${p.label}** — ${formatNumber(p.total)} conversations · ${pct(p.positive + p.very_positive, p.total)} positive · ${pct(p.negative + p.very_negative, p.total)} negative`,
      );
      response.metrics = kpiMetrics(overview).slice(0, 4);
      response.links = [
        { label: "Command Centre", to: "/command-centre" },
        {
          label: "Negative conversations",
          to: "/conversationiq",
          search: { sentiment: "negative" },
        },
      ];
      return response;
    }

    case "language_mix": {
      const overview = await overviewFor(opts);
      const response = base(intent, "Language analytics");
      response.chart = {
        title: "Conversations by language",
        points: overview.languages.slice(0, 8).map((l) => ({
          label: l.name,
          value: l.conversations,
        })),
      };
      response.body = overview.languages
        .slice(0, 6)
        .map(
          (l) =>
            `**${l.name}** — ${formatNumber(l.conversations)} conversations · sentiment ${l.avg_sentiment.toFixed(2)}`,
        );
      response.links = [{ label: "Language analytics", to: "/conversationiq/languages" }];
      return response;
    }

    case "top_keywords": {
      const overview = await overviewFor(opts);
      const top = overview.keywords.slice(0, 8);
      const response = base(intent, "Top keywords");
      response.chart = {
        title: "Mentions",
        points: top.map((k) => ({ label: k.term, value: k.mentions })),
      };
      response.body = top.map(
        (k) =>
          `**${k.term}** — ${formatNumber(k.mentions)} mentions · sentiment ${k.avg_sentiment.toFixed(2)}`,
      );
      if (top[0]) {
        response.entities = { keyword: top[0].term };
        response.links = [
          {
            label: `Conversations mentioning “${top[0].term}”`,
            to: "/conversationiq",
            search: { keyword: top[0].term, from: "copilot" },
          },
          { label: "Keyword library", to: "/conversationiq/keywords" },
        ];
      }
      return response;
    }

    case "open_queue": {
      const response = base(intent, "Reviewer queue");
      response.outcome = "navigated";
      response.autoNavigate = { label: "Reviewer queue", to: "/conversationiq/queue" };
      response.body = ["Opening the ConversationIQ reviewer queue with live SLA tracking."];
      response.links = [
        { label: "Reviewer queue", to: "/conversationiq/queue" },
        { label: "SLA policies", to: "/conversationiq/sla" },
      ];
      return response;
    }

    case "open_conversations": {
      const search: Record<string, unknown> = { from: "copilot" };
      const outletId = ctx?.outletId ?? opts.prefs?.favorite_outlet_id ?? undefined;
      if (outletId) search.outletId = outletId;
      const response = base(intent, "ConversationIQ");
      response.outcome = "navigated";
      response.autoNavigate = { label: "ConversationIQ", to: "/conversationiq", search };
      response.body = [
        outletId
          ? "Opening ConversationIQ with your default outlet filter applied."
          : "Opening ConversationIQ.",
      ];
      response.entities = { outletId };
      response.links = [
        { label: "ConversationIQ", to: "/conversationiq", search },
        { label: "Full-text search", to: "/conversationiq/search" },
      ];
      return response;
    }

    case "open_dashboard": {
      const value = opts.text.toLowerCase();
      const target =
        DASHBOARD_TARGETS.find((d) => value.includes(d.label.toLowerCase())) ??
        DASHBOARD_TARGETS.find((d) => value.includes(d.key.replace("-", " "))) ??
        DASHBOARD_TARGETS[0];
      const response = base(intent, target.label);
      response.outcome = "navigated";
      response.autoNavigate = { label: target.label, to: target.to };
      response.entities = { dashboard: target.key };
      response.body = [`Opening ${target.label}.`];
      response.links = [{ label: target.label, to: target.to }];
      return response;
    }

    case "pin_dashboard": {
      const value = opts.text.toLowerCase();
      const target = DASHBOARD_TARGETS.find((d) => value.includes(d.label.toLowerCase()));
      const response = base(intent, target ? `Pinned ${target.label}` : "Pin a dashboard");
      response.entities = { dashboard: target?.key };
      response.body = target
        ? [`${target.label} is now pinned and will rank first in your copilot suggestions.`]
        : ["Tell me which dashboard to pin, for example “pin command centre”."];
      if (target) response.links = [{ label: target.label, to: target.to }];
      return response;
    }

    case "set_favorite_outlet": {
      const overview = await overviewFor(opts);
      const value = opts.text.toLowerCase();
      const match = overview.outlets.find((o) => value.includes(o.name.toLowerCase()));
      const response = base(intent, match ? `Favourite outlet: ${match.name}` : "Favourite outlet");
      response.entities = match ? { outletId: match.id, outletName: match.name } : {};
      response.body = match
        ? [`${match.name} is now your default outlet filter across the copilot.`]
        : ["Name the outlet, for example “set favourite outlet Canary Wharf”."];
      return response;
    }

    // -- Conversation-scoped intelligence -----------------------------------

    case "summarise_conversation":
    case "translate_conversation":
    case "explain_sentiment": {
      const conversationId = ctx?.conversationId;
      if (!conversationId) {
        const miss = base(intent, "No conversation in context");
        miss.body = ["Open a conversation in ConversationIQ and ask me again."];
        miss.links = [{ label: "ConversationIQ", to: "/conversationiq" }];
        return miss;
      }
      if (!opts.canViewTranscripts) {
        const denied = base(intent, "Transcript access denied");
        denied.outcome = "denied";
        denied.tone = "danger";
        denied.deniedReason = "Your role cannot read transcripts.";
        denied.body = ["Transcript-level analysis requires transcript access."];
        denied.entities = { conversationId };
        return denied;
      }

      const { detail, transcript } = await transcriptFor(opts, conversationId);
      const task =
        intent === "summarise_conversation"
          ? "summarise"
          : intent === "translate_conversation"
            ? "translate"
            : "sentiment";
      const meta = `Reference ${detail.conversation.reference}, topic ${detail.conversation.topic ?? "unknown"}, sentiment ${detail.conversation.sentiment}, language ${detail.conversation.language_code}`;

      const title =
        task === "summarise"
          ? `Summary — ${detail.conversation.reference}`
          : task === "translate"
            ? `Translation — ${detail.conversation.reference}`
            : `Sentiment analysis — ${detail.conversation.reference}`;
      const response = base(intent, title);
      response.entities = { conversationId, reference: detail.conversation.reference };
      response.metrics = [
        { label: "Sentiment", value: detail.conversation.sentiment.replace("_", " ") },
        { label: "Risk", value: detail.conversation.risk_level },
        { label: "Duration", value: formatDuration(detail.conversation.duration_seconds) },
      ];
      response.links = [
        {
          label: "Open conversation",
          to: "/conversationiq/$conversationId",
          params: { conversationId },
        },
      ];

      if (transcript.trim().length === 0) {
        response.body = ["This conversation has no transcript lines to analyse yet."];
        return response;
      }

      try {
        const { text } = await analyseTranscript({
          data: {
            task,
            transcript,
            meta,
            targetLanguage: task === "translate" ? "English" : undefined,
          },
        });
        response.body = text.split("\n").filter((line) => line.trim().length > 0);
      } catch (error) {
        response.outcome = "failed";
        response.tone = "warning";
        response.body = [
          error instanceof Error ? error.message : "The AI analysis could not be completed.",
          detail.summary?.summary
            ? `Stored summary: ${detail.summary.summary}`
            : "No stored summary is available for this conversation.",
        ];
      }
      return response;
    }

    case "related_conversations": {
      const conversationId = ctx?.conversationId;
      if (!conversationId) {
        const miss = base(intent, "No conversation in context");
        miss.body = ["Open a conversation first and I'll find similar ones."];
        return miss;
      }
      const [{ detail }, all] = await Promise.all([
        transcriptFor(opts, conversationId),
        opts.queryClient.ensureQueryData(iqConversationsQuery),
      ]);
      const current = detail.conversation;
      const related = all
        .filter((c) => c.id !== current.id)
        .map((c) => {
          let score = 0;
          if (c.outlet_id && c.outlet_id === current.outlet_id) score += 2;
          if (c.topic && c.topic === current.topic) score += 3;
          if (c.sentiment === current.sentiment) score += 1;
          if (c.language_code === current.language_code) score += 1;
          return { c, score };
        })
        .filter((r) => r.score >= 3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      const response = base(intent, `Related to ${current.reference}`);
      response.entities = { conversationId, reference: current.reference };
      response.body =
        related.length > 0
          ? related.map(
              ({ c }) =>
                `**${c.reference}** — ${c.topic ?? "General"} · ${c.sentiment.replace("_", " ")} · ${new Date(c.started_at).toLocaleDateString()}`,
            )
          : ["No closely related conversations in the current window."];
      response.links = related.map(({ c }) => ({
        label: c.reference,
        to: "/conversationiq/$conversationId",
        params: { conversationId: c.id },
      }));
      return response;
    }

    case "help":
      return {
        ...base("help", "What I can do"),
        body: [
          "**Executive** — generate executive report, compare regions, outlet ranking, sentiment overview, export report as PDF/Excel/CSV.",
          "**Operations** — open alerts, open reviewer queue, top keywords, language analytics.",
          "**On a conversation** — summarise, translate, explain sentiment, show related conversations.",
          "**Personalisation** — set favourite outlet, pin a dashboard.",
        ],
        links: [{ label: "Command Centre", to: "/command-centre" }],
      };

    default: {
      const overview = await overviewFor(opts);
      const response = base("unknown", "I couldn't match that command");
      response.tone = "warning";
      response.body = [
        `Here's the current position for ${rangeLabel(opts.filters)} while you rephrase.`,
        ...executiveBriefing(overview).slice(0, 2),
        "Try “generate executive report”, “compare regions” or “open alerts”.",
      ];
      response.metrics = kpiMetrics(overview).slice(0, 4);
      return response;
    }
  }
}

// ---------------------------------------------------------------------------
// Entity confirmation & clarification
// ---------------------------------------------------------------------------

const MENTION_RE =
  /\b(?:outlet|store|branch|site|region|employee|agent|staff|colleague|for|at|in)\s+([a-z0-9][a-z0-9'’&\-. ]{2,40})/i;

const MENTION_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "today",
  "yesterday",
  "week",
  "month",
  "year",
  "please",
  "report",
  "reports",
  "now",
  "last",
  "past",
  "and",
  "with",
  "summary",
  "sentiment",
  "conversations",
  "conversation",
  "alerts",
  "alert",
  "export",
  "pdf",
  "excel",
  "csv",
  "deck",
  "powerpoint",
  "performance",
  "ranking",
  "score",
  "scores",
  "me",
  "my",
  "our",
  "us",
  "all",
  "of",
  "to",
  "by",
  "top",
  "worst",
  "best",
  "show",
  "open",
  "give",
  "days",
  "day",
]);

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s'’&-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !MENTION_STOPWORDS.has(token));
}

function extractMention(text: string): string | null {
  const match = MENTION_RE.exec(text);
  if (!match) return null;
  const phrase = tokens(match[1]).join(" ");
  return phrase.length >= 2 ? phrase : null;
}

interface Candidate {
  kind: "outlet" | "region" | "employee";
  label: string;
  hint?: string;
}

function scoreCandidate(candidate: Candidate, mentionTokens: string[]): number {
  const candidateTokens = tokens(candidate.label);
  let score = 0;
  for (const token of mentionTokens) {
    if (candidateTokens.includes(token)) score += 2;
    else if (candidateTokens.some((c) => c.startsWith(token) || token.startsWith(c))) score += 1;
  }
  return score;
}

/**
 * Returns a clarification response when the command names an outlet, region or
 * employee the resolver cannot bind with confidence. Commands that name an
 * entity exactly execute untouched.
 */
async function clarifyEntities(
  opts: ResolveOptions,
  intent: CopilotIntent,
): Promise<CopilotResponse | null> {
  const skip: CopilotIntent[] = [
    "help",
    "unknown",
    "summarise_conversation",
    "translate_conversation",
    "explain_sentiment",
    "related_conversations",
    "open_dashboard",
    "pin_dashboard",
  ];
  if (skip.includes(intent)) return null;

  const mention = extractMention(opts.text);
  if (!mention) return null;

  const overview = await overviewFor(opts);
  const options = overview.filterOptions;
  const candidates: Candidate[] = [
    ...options.outlets.map((o) => ({
      kind: "outlet" as const,
      label: o.name,
      hint: o.region ?? undefined,
    })),
    ...options.regions.map((r) => ({ kind: "region" as const, label: r })),
    ...(options.employees ?? []).map((e) => ({ kind: "employee" as const, label: e })),
  ];
  if (candidates.length === 0) return null;

  const lower = opts.text.toLowerCase();
  const exact = candidates.filter(
    (c) => c.label.length > 2 && lower.includes(c.label.toLowerCase()),
  );
  if (exact.length === 1) return null;

  const mentionTokens = tokens(mention);
  const scored = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, mentionTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  // A single strong match with no rival is confident enough to run.
  if (exact.length === 0 && scored.length === 0) return null;
  if (exact.length === 0 && scored.length === 1 && scored[0].score >= mentionTokens.length * 2) {
    return null;
  }

  const shortlist = (
    exact.length > 1 ? exact.map((candidate) => ({ candidate, score: 99 })) : scored
  ).slice(0, 5);
  if (shortlist.length === 0) return null;

  const field = shortlist[0].candidate.kind;
  const response = base(intent, `Which ${field} did you mean?`);
  response.outcome = "clarify";
  response.tone = "warning";
  response.body = [
    `I matched **${mention}** to more than one ${field}. Confirm the right one and I'll run “${opts.text}” against it.`,
  ];
  response.clarification = {
    question: `Confirm the ${field} for this command.`,
    field,
    options: shortlist.map(({ candidate }) => ({
      label: candidate.label,
      hint: candidate.hint,
      command:
        `${opts.text.replace(new RegExp(mention, "i"), "").trim()} ${candidate.label}`.trim(),
    })),
  };
  response.entities =
    field === "region"
      ? { region: shortlist[0].candidate.label }
      : field === "employee"
        ? { employee: shortlist[0].candidate.label }
        : { outletName: shortlist[0].candidate.label };
  return response;
}

// ---------------------------------------------------------------------------
// Follow-up chaining
// ---------------------------------------------------------------------------

function followUpsFor(response: CopilotResponse): CopilotFollowUp[] {
  const entities = response.entities;
  const outlet = entities.outletName;
  const region = entities.region;

  const chips: CopilotFollowUp[] = (() => {
    switch (response.intent) {
      case "executive_report":
        return [
          { label: "Export as PDF", command: "export report as PDF" },
          { label: "Compare regions", command: "compare regions" },
          { label: "Outlet ranking", command: "show outlet ranking" },
          { label: "Open alerts", command: "open alerts" },
        ];
      case "export_report":
        return [
          { label: "Executive report", command: "generate executive report" },
          { label: "Scheduled reports", command: "open reports dashboard" },
        ];
      case "compare_regions":
        return [
          region
            ? { label: `Outlets in ${region}`, command: `outlet ranking for region ${region}` }
            : { label: "Outlet ranking", command: "show outlet ranking" },
          { label: "Sentiment overview", command: "sentiment overview" },
          { label: "Executive report", command: "generate executive report" },
        ];
      case "outlet_ranking":
        return [
          outlet
            ? { label: `Alerts at ${outlet}`, command: `open alerts for outlet ${outlet}` }
            : { label: "Open alerts", command: "open alerts" },
          outlet
            ? { label: `Make ${outlet} my default`, command: `set favourite outlet ${outlet}` }
            : { label: "Compare regions", command: "compare regions" },
          { label: "Top keywords", command: "top keywords" },
        ];
      case "sentiment_overview":
        return [
          { label: "Top keywords", command: "top keywords" },
          { label: "Outlet ranking", command: "show outlet ranking" },
          { label: "Executive report", command: "generate executive report" },
        ];
      case "top_keywords":
        return [
          entities.keyword
            ? {
                label: `Conversations: ${entities.keyword}`,
                command: `open conversations ${entities.keyword}`,
              }
            : { label: "Open conversations", command: "open conversations" },
          { label: "Sentiment overview", command: "sentiment overview" },
        ];
      case "language_mix":
        return [
          { label: "Sentiment overview", command: "sentiment overview" },
          { label: "Top keywords", command: "top keywords" },
        ];
      case "open_alerts":
        return [
          { label: "Reviewer queue", command: "open reviewer queue" },
          { label: "Executive report", command: "generate executive report" },
        ];
      case "open_queue":
        return [
          { label: "Open alerts", command: "open alerts" },
          { label: "Outlet ranking", command: "show outlet ranking" },
        ];
      case "summarise_conversation":
        return [
          { label: "Explain sentiment", command: "explain the sentiment" },
          { label: "Translate", command: "translate this conversation" },
          { label: "Related conversations", command: "show related conversations" },
        ];
      case "translate_conversation":
        return [
          { label: "Summarise", command: "summarise this conversation" },
          { label: "Explain sentiment", command: "explain the sentiment" },
        ];
      case "explain_sentiment":
        return [
          { label: "Summarise", command: "summarise this conversation" },
          { label: "Related conversations", command: "show related conversations" },
        ];
      case "related_conversations":
        return [
          { label: "Summarise", command: "summarise this conversation" },
          { label: "Open ConversationIQ", command: "open conversations" },
        ];
      case "open_conversations":
        return [
          { label: "Reviewer queue", command: "open reviewer queue" },
          { label: "Top keywords", command: "top keywords" },
        ];
      default:
        return [
          { label: "Executive report", command: "generate executive report" },
          { label: "Open alerts", command: "open alerts" },
          { label: "What can you do?", command: "help" },
        ];
    }
  })();

  return chips.slice(0, 4);
}

/**
 * Public entry point: strips an approval prefix, confirms ambiguous entities,
 * resolves the intent (streaming partials where supported) and attaches
 * follow-up chips.
 */
export async function resolveCopilotCommand(input: ResolveOptions): Promise<CopilotResponse> {
  const { text, confirmed } = stripConfirmation(input.text.trim());
  const opts: ResolveOptions = { ...input, text, confirmed: input.confirmed || confirmed };
  const intent = detectIntent(opts.text, opts.context);
  try {
    const clarification = await clarifyEntities(opts, intent);
    if (clarification) return clarification;
  } catch {
    // Clarification is best-effort — never block the command on it.
  }
  const response = await resolveIntent(opts);
  if (!response.clarification && !response.preview) response.followUps = followUpsFor(response);
  return response;
}
