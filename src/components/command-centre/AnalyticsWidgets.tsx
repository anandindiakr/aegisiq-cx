import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, MessageSquare, Radio } from "lucide-react";

import { Panel } from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { DonutChart } from "./charts";
import { rankedIssues } from "@/features/command-centre/insights";
import type { ExecutiveOverview } from "@/features/command-centre/types";

export function LanguageAnalytics({
  overview,
  onSelect,
}: {
  overview: ExecutiveOverview;
  onSelect: (code: string) => void;
}) {
  const data = overview.languages
    .filter((l) => l.conversations > 0)
    .map((l) => ({ label: l.name, value: l.conversations }));
  const byName = new Map(overview.languages.map((l) => [l.name, l.code]));

  return (
    <Panel title="Language Analytics" description="Conversation mix by detected language">
      {data.length ? (
        <>
          <DonutChart
            data={data}
            onSelect={(label) => {
              const code = byName.get(label);
              if (code) onSelect(code);
            }}
          />
          <ul className="mt-1 space-y-1.5">
            {overview.languages
              .filter((l) => l.conversations > 0)
              .slice(0, 5)
              .map((l) => (
                <li key={l.code} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{l.name}</span>
                  <span className="tabular-nums">
                    {formatNumber(l.conversations)} · sentiment {l.avg_sentiment.toFixed(2)}
                  </span>
                </li>
              ))}
          </ul>
        </>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No language activity in this selection.
        </p>
      )}
    </Panel>
  );
}

export function KeywordCloud({
  overview,
  onSelect,
}: {
  overview: ExecutiveOverview;
  onSelect: (term: string) => void;
}) {
  const items = overview.keywords.slice(0, 40);
  const max = Math.max(1, ...items.map((k) => k.mentions));

  return (
    <Panel title="Top Keywords" description="Most mentioned terms, sized by frequency">
      {items.length ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
          {items.map((k) => {
            const weight = k.mentions / max;
            const tone =
              k.avg_sentiment > 0.15
                ? "text-success"
                : k.avg_sentiment < -0.15
                  ? "text-destructive"
                  : "text-foreground/80";
            return (
              <button
                key={k.term}
                type="button"
                onClick={() => onSelect(k.term)}
                title={`${k.mentions} mentions · sentiment ${k.avg_sentiment.toFixed(2)}`}
                className={cn(
                  "rounded-md px-1.5 py-0.5 leading-tight transition-colors hover:bg-accent",
                  tone,
                )}
                style={{
                  fontSize: `${0.75 + weight * 0.95}rem`,
                  fontWeight: 400 + Math.round(weight * 3) * 100,
                  opacity: 0.55 + weight * 0.45,
                }}
              >
                {k.term}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">No keywords detected.</p>
      )}
    </Panel>
  );
}

const SEVERITY_CLASS: Record<string, string> = {
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  medium: "border-warning/40 bg-warning/10 text-warning",
  low: "border-info/40 bg-info/10 text-info",
};

export function AlertOverview({ overview }: { overview: ExecutiveOverview }) {
  const severities = Object.entries(overview.alertsBySeverity).sort((a, b) => b[1] - a[1]);
  const categories = Object.entries(overview.alertsByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxCategory = Math.max(1, ...categories.map(([, v]) => v));

  return (
    <Panel
      title="Alert Overview"
      description="AI alerts raised in the selected window"
      actions={
        <Badge variant="outline" className="gap-1.5 text-[11px] text-muted-foreground">
          <AlertTriangle className="size-3" />
          {formatNumber(overview.kpis.alerts)} total
        </Badge>
      }
    >
      <div className="grid gap-2 sm:grid-cols-4">
        {severities.map(([severity, count]) => (
          <div
            key={severity}
            className={cn("rounded-lg border p-3", SEVERITY_CLASS[severity] ?? "border-border")}
          >
            <p className="text-[10px] uppercase tracking-wide">{severity}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {formatNumber(count)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2.5">
        {categories.map(([category, count]) => (
          <div key={category}>
            <div className="flex items-center justify-between text-xs">
              <span className="capitalize text-muted-foreground">
                {category.replace(/_/g, " ")}
              </span>
              <span className="tabular-nums">{formatNumber(count)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(count / maxCategory) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Latest alerts
        </p>
        {overview.recentAlerts.slice(0, 5).map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-surface/40 px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium">{alert.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {alert.outlet_name ?? "Unassigned"} ·{" "}
                {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
              </span>
            </span>
            <Badge
              variant="outline"
              className={cn("shrink-0 text-[10px]", SEVERITY_CLASS[alert.severity])}
            >
              {alert.severity}
            </Badge>
          </div>
        ))}
        {overview.recentAlerts.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No alerts raised in this window.
          </p>
        )}
      </div>
    </Panel>
  );
}

export function TopIssues({ overview }: { overview: ExecutiveOverview }) {
  const issues = useMemo(() => rankedIssues(overview).slice(0, 8), [overview]);

  return (
    <Panel title="Top Issues" description="Ranked by occurrence and negative impact">
      <ol className="space-y-2">
        {issues.map((issue, index) => (
          <li
            key={issue.label}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/12 text-[11px] font-semibold text-primary">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{issue.label}</span>
              <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary/70"
                  style={{ width: `${issue.impact}%` }}
                />
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold tabular-nums">
                {formatNumber(issue.occurrences)}
              </span>
              <span
                className={cn(
                  "block text-[11px] tabular-nums",
                  issue.trend > 0 ? "text-destructive" : "text-success",
                )}
              >
                {issue.trend >= 0 ? "+" : ""}
                {issue.trend.toFixed(0)}%
              </span>
            </span>
          </li>
        ))}
        {issues.length === 0 && (
          <li className="py-8 text-center text-sm text-muted-foreground">No issues detected.</li>
        )}
      </ol>
    </Panel>
  );
}

export function ActivityFeed({
  overview,
  onOpenConversation,
}: {
  overview: ExecutiveOverview;
  onOpenConversation: (id: string) => void;
}) {
  return (
    <Panel
      title="Live Activity Feed"
      description="Most recent conversations and alerts across the estate"
      actions={
        <span className="inline-flex items-center gap-1.5 text-[11px] text-success">
          <Radio className="size-3 animate-pulse" />
          Live
        </span>
      }
    >
      <ScrollArea className="h-[360px] pr-3">
        <ol className="space-y-2">
          {overview.activity.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <button
                type="button"
                disabled={!item.conversation_id}
                onClick={() => item.conversation_id && onOpenConversation(item.conversation_id)}
                className="flex w-full items-start gap-3 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5 text-left transition-colors enabled:hover:border-primary/40 disabled:cursor-default"
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ring-1",
                    item.kind === "alert"
                      ? "bg-destructive/10 text-destructive ring-destructive/25"
                      : "bg-primary/10 text-primary ring-primary/25",
                  )}
                >
                  {item.kind === "alert" ? (
                    <AlertTriangle className="size-3.5" />
                  ) : (
                    <MessageSquare className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{item.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {item.detail}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                </span>
              </button>
            </li>
          ))}
          {overview.activity.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">No recent activity.</li>
          )}
        </ol>
      </ScrollArea>
    </Panel>
  );
}
