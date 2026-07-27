import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  Lightbulb,
  Minus,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/common/Primitives";
import { cn } from "@/lib/utils";
import {
  executiveBriefing,
  insights as buildInsights,
  recommendations as buildRecommendations,
  type Insight,
} from "@/features/command-centre/insights";
import type { ExecutiveOverview } from "@/features/command-centre/types";

const TONE_CLASS: Record<Insight["tone"], string> = {
  positive: "border-success/30 bg-success/8 text-success",
  negative: "border-destructive/30 bg-destructive/8 text-destructive",
  warning: "border-warning/30 bg-warning/8 text-warning",
  neutral: "border-info/30 bg-info/8 text-info",
};

function ToneIcon({ tone }: { tone: Insight["tone"] }) {
  if (tone === "positive") return <ArrowUpRight className="size-3.5" />;
  if (tone === "negative" || tone === "warning") return <ArrowDownRight className="size-3.5" />;
  return <Minus className="size-3.5" />;
}

export function ExecutiveSummary({ overview }: { overview: ExecutiveOverview }) {
  const lines = executiveBriefing(overview);
  return (
    <Panel
      title="Executive AI Summary"
      description="Narrative briefing generated from the current filter selection"
      actions={
        <Badge variant="outline" className="gap-1.5 border-primary/40 text-[11px] text-primary">
          <Sparkles className="size-3" />
          AI generated
        </Badge>
      }
    >
      <div className="relative overflow-hidden rounded-lg border border-border/70 bg-surface/50 p-5">
        <span className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/25">
            <BrainCircuit className="size-4" />
          </span>
          <div className="space-y-2.5">
            {lines.map((line, index) => (
              <motion.p
                key={line}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.3 }}
                className="text-sm leading-relaxed text-foreground/90"
              >
                {line}
              </motion.p>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function InsightCards({ overview }: { overview: ExecutiveOverview }) {
  const items = buildInsights(overview);
  return (
    <Panel title="AI Insight Cards" description="Anomalies and movements detected in this window">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((insight, index) => (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
            className={cn("rounded-lg border p-4", TONE_CLASS[insight.tone])}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug text-foreground">{insight.title}</p>
              {insight.metric && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums">
                  <ToneIcon tone={insight.tone} />
                  {insight.metric}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{insight.detail}</p>
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}

const PRIORITY: Record<string, string> = {
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  medium: "border-warning/40 bg-warning/10 text-warning",
  low: "border-border bg-muted/40 text-muted-foreground",
};

export function RecommendationCards({ overview }: { overview: ExecutiveOverview }) {
  const items = buildRecommendations(overview);
  return (
    <Panel
      title="AI Recommendations"
      description="Suggested operational actions ranked by business impact"
    >
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((rec, index) => (
          <motion.article
            key={rec.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.28 }}
            className="rounded-lg border border-border/70 bg-surface/40 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/25">
                <Lightbulb className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{rec.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{rec.detail}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px] uppercase", PRIORITY[rec.priority])}>
                {rec.priority} priority
              </Badge>
              <span className="text-[11px] text-muted-foreground">Owner · {rec.owner}</span>
            </div>
          </motion.article>
        ))}
      </div>
    </Panel>
  );
}
