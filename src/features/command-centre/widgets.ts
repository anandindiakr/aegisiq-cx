/** Widget registry powering reordering and visibility in Dashboard Settings. */
export interface WidgetDef {
  id: string;
  label: string;
  description: string;
}

export const WIDGETS: WidgetDef[] = [
  { id: "kpis", label: "KPI Cards", description: "Twelve headline indicators with period deltas" },
  { id: "summary", label: "Executive AI Summary", description: "Narrative briefing" },
  { id: "score", label: "CX Score Gauge", description: "Composite experience index" },
  { id: "sentiment", label: "Sentiment Overview", description: "Distribution, trend and hourly volume" },
  { id: "outlets", label: "Outlet Performance", description: "Ranked outlet league table" },
  { id: "map", label: "Outlet Map", description: "Geographic distribution" },
  { id: "languages", label: "Language Analytics", description: "Conversation mix by language" },
  { id: "keywords", label: "Top Keywords", description: "Keyword cloud" },
  { id: "alerts", label: "Alert Overview", description: "Severity, category and latest alerts" },
  { id: "issues", label: "Top Issues", description: "Ranked issue impact list" },
  { id: "regions", label: "Regional Comparison", description: "Region-level league table" },
  { id: "recommendations", label: "AI Recommendations", description: "Suggested actions" },
  { id: "insights", label: "AI Insight Cards", description: "Detected anomalies and movements" },
  { id: "activity", label: "Live Activity Feed", description: "Streaming conversations and alerts" },
];

export const DEFAULT_ORDER = WIDGETS.map((w) => w.id);

export function resolveOrder(order: string[] | undefined): string[] {
  const known = new Set(DEFAULT_ORDER);
  const ordered = (order ?? []).filter((id) => known.has(id));
  const missing = DEFAULT_ORDER.filter((id) => !ordered.includes(id));
  return [...ordered, ...missing];
}

export function moveWidget(order: string[], id: string, direction: -1 | 1): string[] {
  const index = order.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
