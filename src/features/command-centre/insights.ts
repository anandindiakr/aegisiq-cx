/**
 * Deterministic executive intelligence layer.
 *
 * Produces the narrative briefing, recommendations and insight cards from the
 * aggregated overview. Deliberately pure and synchronous so widgets never show
 * an empty state; the same contract will be served by a generative model once
 * the AI briefing service is enabled.
 */
import type { ExecutiveOverview, OutletPerformance } from "./types";

export interface Insight {
  id: string;
  title: string;
  detail: string;
  tone: "positive" | "negative" | "neutral" | "warning";
  metric?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
  owner: string;
}

function pct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function signed(value: number, digits = 0): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function deltaPercent(current: number, previous: number): number {
  return pct(current, previous);
}

/** Overall CX score, 0–100. */
export function cxScore(overview: ExecutiveOverview): number {
  const k = overview.kpis;
  if (!k.total) return 0;
  const sentimentComponent = ((k.avg_sentiment + 1) / 2) * 70;
  const positiveShare = (k.positive / k.total) * 20;
  const escalationPenalty = (k.escalations / k.total) * 30;
  const complaintPenalty = (k.complaints / k.total) * 12;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(sentimentComponent + positiveShare + 10 - escalationPenalty - complaintPenalty),
    ),
  );
}

export function cxBand(score: number): { label: string; tone: Insight["tone"] } {
  if (score >= 80) return { label: "Excellent", tone: "positive" };
  if (score >= 65) return { label: "Good", tone: "neutral" };
  if (score >= 45) return { label: "Needs Improvement", tone: "warning" };
  return { label: "Critical", tone: "negative" };
}

export function bestOutlet(overview: ExecutiveOverview): OutletPerformance | null {
  const ranked = overview.outlets.filter((o) => o.conversations > 0);
  return ranked.length ? ranked[0] : null;
}

export function worstOutlet(overview: ExecutiveOverview): OutletPerformance | null {
  const ranked = overview.outlets.filter((o) => o.conversations > 0);
  return ranked.length ? ranked[ranked.length - 1] : null;
}

/** Multi-paragraph executive briefing. */
export function executiveBriefing(overview: ExecutiveOverview): string[] {
  const k = overview.kpis;
  if (!k.total) {
    return [
      "No conversations were captured for the selected filters.",
      "Widen the date range or clear filters to restore estate-wide visibility.",
    ];
  }

  const satisfactionDelta = pct(k.avg_sentiment + 1, k.avg_sentiment_prev + 1);
  const best = bestOutlet(overview);
  const worst = worstOutlet(overview);
  const topIssues = overview.issues.slice(0, 2).map((i) => i.label.toLowerCase());
  const score = cxScore(overview);
  const band = cxBand(score).label.toLowerCase();

  const lines = [
    `Customer experience across ${k.active_outlets} active outlets is ${band}, with ${k.total.toLocaleString("en-GB")} conversations captured and an overall CX score of ${score}.`,
    `Customer satisfaction ${satisfactionDelta >= 0 ? "increased" : "declined"} by ${Math.abs(satisfactionDelta).toFixed(1)}% versus the preceding period, with ${k.positive.toLocaleString("en-GB")} positive and ${k.negative.toLocaleString("en-GB")} negative interactions.`,
  ];

  if (best) {
    lines.push(
      `${best.name} generated the highest quality interactions (${best.positive_rate.toFixed(0)}% positive across ${best.conversations.toLocaleString("en-GB")} conversations).`,
    );
  }
  if (topIssues.length) {
    lines.push(`Most complaints related to ${topIssues.join(" and ")}.`);
  }
  if (worst && worst.id !== best?.id) {
    lines.push(
      `Recommendation: prioritise a service and policy refresher at ${worst.name}, where the complaint rate is ${worst.complaint_rate.toFixed(0)}% and ${worst.escalations} escalations were recorded.`,
    );
  }
  return lines;
}

export function recommendations(overview: ExecutiveOverview): Recommendation[] {
  const k = overview.kpis;
  const out: Recommendation[] = [];
  const worst = worstOutlet(overview);
  const topIssue = overview.issues[0];
  const peakHour = [...overview.hourly].sort((a, b) => b.conversations - a.conversations)[0];
  const risingLanguage = [...overview.languages]
    .filter((l) => l.prev_count > 0)
    .sort((a, b) => pct(b.conversations, b.prev_count) - pct(a.conversations, a.prev_count))[0];

  if (peakHour) {
    out.push({
      id: "staffing",
      title: `Increase staffing between ${peakHour.hour}:00 and ${(peakHour.hour + 2) % 24}:00`,
      detail: `Volume peaks at ${peakHour.conversations.toLocaleString("en-GB")} conversations with average sentiment ${peakHour.avg_sentiment.toFixed(2)}. Adding a second service lead during the peak protects satisfaction.`,
      priority: peakHour.avg_sentiment < 0 ? "high" : "medium",
      owner: "Operations",
    });
  }
  if (worst && topIssue) {
    out.push({
      id: "outlet-training",
      title: `${worst.name} has repeated ${topIssue.label.toLowerCase()} complaints`,
      detail: `${worst.complaint_rate.toFixed(0)}% of conversations at this outlet ended negatively. Schedule a policy refresher and shadow-coaching cycle this week.`,
      priority: "high",
      owner: "Regional Manager",
    });
  }
  if (k.refunds > 0) {
    out.push({
      id: "refund-policy",
      title: "Provide a refund policy refresher",
      detail: `${k.refunds.toLocaleString("en-GB")} refund conversations were captured (${signed(pct(k.refunds, k.refunds_prev), 1)}% vs previous period). Align frontline scripts with the current refund window.`,
      priority: pct(k.refunds, k.refunds_prev) > 10 ? "high" : "medium",
      owner: "Customer Care",
    });
  }
  if (risingLanguage) {
    out.push({
      id: "language",
      title: `Customers speaking ${risingLanguage.name} increased`,
      detail: `${risingLanguage.name} conversations moved ${signed(pct(risingLanguage.conversations, risingLanguage.prev_count), 1)}%. Ensure a fluent speaker is rostered on the busiest shifts.`,
      priority: "medium",
      owner: "Workforce Planning",
    });
  }
  out.push({
    id: "promotion",
    title: "Review promotion communication",
    detail: `Promotion confusion accounts for ${overview.issues.find((i) => i.label === "Promotion Confusion")?.occurrences ?? 0} conversations. Simplify in-store signage and re-brief staff on eligibility rules.`,
    priority: "low",
    owner: "Marketing",
  });
  return out;
}

export function insights(overview: ExecutiveOverview): Insight[] {
  const k = overview.kpis;
  const out: Insight[] = [];

  const complaintDelta = pct(k.complaints, k.complaints_prev);
  out.push({
    id: "complaints",
    title: `Complaint rate ${complaintDelta >= 0 ? "increased" : "decreased"} ${Math.abs(complaintDelta).toFixed(0)}%`,
    detail: `${k.complaints.toLocaleString("en-GB")} complaint-led conversations against ${k.complaints_prev.toLocaleString("en-GB")} in the previous period.`,
    tone: complaintDelta > 0 ? "negative" : "positive",
    metric: `${signed(complaintDelta)}%`,
  });

  const sentimentDelta = pct(k.avg_sentiment + 1, k.avg_sentiment_prev + 1);
  out.push({
    id: "sentiment",
    title: `Average sentiment ${sentimentDelta >= 0 ? "improved" : "softened"}`,
    detail: `Estate sentiment is ${k.avg_sentiment.toFixed(2)} versus ${k.avg_sentiment_prev.toFixed(2)} previously.`,
    tone: sentimentDelta >= 0 ? "positive" : "negative",
    metric: `${signed(sentimentDelta, 1)}%`,
  });

  const refundDelta = pct(k.refunds, k.refunds_prev);
  out.push({
    id: "refunds",
    title: `Refund requests ${refundDelta >= 0 ? "rose" : "dropped"} ${Math.abs(refundDelta).toFixed(0)}%`,
    detail: `${k.refunds.toLocaleString("en-GB")} refund conversations detected in the selected window.`,
    tone: refundDelta > 0 ? "warning" : "positive",
    metric: `${signed(refundDelta)}%`,
  });

  const growth = [...overview.languages]
    .filter((l) => l.conversations > 0)
    .sort((a, b) => pct(b.conversations, b.prev_count) - pct(a.conversations, a.prev_count))[0];
  if (growth) {
    out.push({
      id: "language-mix",
      title: `${growth.name} conversations increased`,
      detail: `${growth.name} now accounts for ${((growth.conversations / Math.max(1, k.total)) * 100).toFixed(0)}% of all captured conversations.`,
      tone: "neutral",
      metric: `${signed(pct(growth.conversations, growth.prev_count))}%`,
    });
  }

  const escalationDelta = pct(k.escalations, k.escalations_prev);
  out.push({
    id: "escalations",
    title: `Manager escalations ${escalationDelta >= 0 ? "up" : "down"} ${Math.abs(escalationDelta).toFixed(0)}%`,
    detail: `${k.escalations.toLocaleString("en-GB")} conversations required a manager, ${((k.escalations / Math.max(1, k.total)) * 100).toFixed(1)}% of total volume.`,
    tone: escalationDelta > 0 ? "warning" : "positive",
    metric: `${signed(escalationDelta)}%`,
  });

  return out;
}

/** Ranked issues with impact scoring for the Top Issues widget. */
export function rankedIssues(overview: ExecutiveOverview) {
  const max = Math.max(1, ...overview.issues.map((i) => i.occurrences));
  return overview.issues.map((issue) => ({
    ...issue,
    trend: pct(issue.occurrences, issue.prev_count),
    impact: Math.round((issue.occurrences / max) * 70 + Math.max(0, -issue.avg_sentiment) * 30),
  }));
}
