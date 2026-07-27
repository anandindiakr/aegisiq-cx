import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Cctv,
  Clock3,
  Frown,
  Gauge,
  MessagesSquare,
  Receipt,
  ShieldAlert,
  Siren,
  Smile,
  Store,
  UserRoundCog,
  Wrench,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { deltaPercent } from "@/features/command-centre/insights";
import type { ExecutiveKpis } from "@/features/command-centre/types";

export type KpiKey =
  | "total"
  | "positive"
  | "negative"
  | "sentiment"
  | "duration"
  | "complaints"
  | "refunds"
  | "warranty"
  | "escalations"
  | "alerts"
  | "outlets"
  | "cameras";

interface KpiDef {
  key: KpiKey;
  label: string;
  icon: LucideIcon;
  value: (k: ExecutiveKpis) => string;
  delta?: (k: ExecutiveKpis) => number;
  hint: (k: ExecutiveKpis) => string;
  invert?: boolean;
}

const KPIS: KpiDef[] = [
  {
    key: "total",
    label: "Total Conversations",
    icon: MessagesSquare,
    value: (k) => formatNumber(k.total),
    delta: (k) => deltaPercent(k.total, k.total_prev),
    hint: () => "vs previous period",
  },
  {
    key: "positive",
    label: "Positive Conversations",
    icon: Smile,
    value: (k) => formatNumber(k.positive),
    delta: (k) => deltaPercent(k.positive, k.positive_prev),
    hint: (k) => `${((k.positive / Math.max(1, k.total)) * 100).toFixed(0)}% of volume`,
  },
  {
    key: "negative",
    label: "Negative Conversations",
    icon: Frown,
    value: (k) => formatNumber(k.negative),
    delta: (k) => deltaPercent(k.negative, k.negative_prev),
    hint: (k) => `${((k.negative / Math.max(1, k.total)) * 100).toFixed(0)}% of volume`,
    invert: true,
  },
  {
    key: "sentiment",
    label: "Average Sentiment",
    icon: Gauge,
    value: (k) => k.avg_sentiment.toFixed(2),
    delta: (k) => deltaPercent(k.avg_sentiment + 1, k.avg_sentiment_prev + 1),
    hint: () => "scale −1 to +1",
  },
  {
    key: "duration",
    label: "Average Duration",
    icon: Clock3,
    value: (k) => `${Math.floor(k.avg_duration / 60)}m ${Math.round(k.avg_duration % 60)}s`,
    delta: (k) => deltaPercent(k.avg_duration, k.avg_duration_prev),
    hint: () => "per conversation",
    invert: true,
  },
  {
    key: "complaints",
    label: "Complaints",
    icon: ShieldAlert,
    value: (k) => formatNumber(k.complaints),
    delta: (k) => deltaPercent(k.complaints, k.complaints_prev),
    hint: () => "service & pricing led",
    invert: true,
  },
  {
    key: "refunds",
    label: "Refund Requests",
    icon: Receipt,
    value: (k) => formatNumber(k.refunds),
    delta: (k) => deltaPercent(k.refunds, k.refunds_prev),
    hint: () => "refund intent detected",
    invert: true,
  },
  {
    key: "warranty",
    label: "Warranty Requests",
    icon: Wrench,
    value: (k) => formatNumber(k.warranty),
    delta: (k) => deltaPercent(k.warranty, k.warranty_prev),
    hint: () => "claims & repairs",
    invert: true,
  },
  {
    key: "escalations",
    label: "Manager Escalations",
    icon: UserRoundCog,
    value: (k) => formatNumber(k.escalations),
    delta: (k) => deltaPercent(k.escalations, k.escalations_prev),
    hint: (k) => `${((k.escalations / Math.max(1, k.total)) * 100).toFixed(1)}% of volume`,
    invert: true,
  },
  {
    key: "alerts",
    label: "AI Alerts",
    icon: Siren,
    value: (k) => formatNumber(k.alerts),
    hint: () => "raised in this window",
    invert: true,
  },
  {
    key: "outlets",
    label: "Active Outlets",
    icon: Store,
    value: (k) => formatNumber(k.active_outlets),
    hint: (k) => `of ${k.total_outlets} in estate`,
  },
  {
    key: "cameras",
    label: "Online Cameras",
    icon: Cctv,
    value: (k) => formatNumber(k.online_cameras),
    hint: (k) => `of ${k.total_cameras} deployed`,
  },
];

export function KpiGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-[116px] w-full rounded-xl bg-muted/50" />
      ))}
    </div>
  );
}

export function KpiGrid({
  kpis,
  onDrillDown,
}: {
  kpis: ExecutiveKpis;
  onDrillDown: (key: KpiKey) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {KPIS.map((def, index) => {
        const delta = def.delta ? def.delta(kpis) : null;
        const good = delta === null ? null : def.invert ? delta <= 0 : delta >= 0;
        return (
          <motion.button
            key={def.key}
            type="button"
            onClick={() => onDrillDown(def.key)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03, ease: "easeOut" }}
            whileHover={{ y: -3 }}
            className="panel group relative overflow-hidden p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${def.label}: ${def.value(kpis)}. Open drilldown.`}
          >
            <span className="pointer-events-none absolute inset-x-0 -top-16 h-24 bg-primary/10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
            <span className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {def.label}
              </span>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/25">
                <def.icon className="size-4" />
              </span>
            </span>
            <span className="mt-3 block text-2xl font-semibold tracking-tight tabular-nums">
              {def.value(kpis)}
            </span>
            <span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              {delta !== null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium tabular-nums",
                    good
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-destructive/30 bg-destructive/10 text-destructive",
                  )}
                >
                  <Activity className="size-3" />
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)}%
                </span>
              )}
              <span className="truncate">{def.hint(kpis)}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
