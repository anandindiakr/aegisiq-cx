import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CategoryBarChart } from "./charts";
import { formatNumber } from "@/lib/format";
import type { KpiKey } from "./KpiGrid";
import type { ExecutiveOverview, OutletPerformance } from "@/features/command-centre/types";

export interface DrillDown {
  kind: "kpi" | "outlet";
  kpi?: KpiKey;
  outlet?: OutletPerformance;
}

const KPI_TITLES: Record<KpiKey, string> = {
  total: "Total Conversations",
  positive: "Positive Conversations",
  negative: "Negative Conversations",
  sentiment: "Average Sentiment",
  duration: "Average Duration",
  complaints: "Complaints",
  refunds: "Refund Requests",
  warranty: "Warranty Requests",
  escalations: "Manager Escalations",
  alerts: "AI Alerts",
  outlets: "Active Outlets",
  cameras: "Online Cameras",
};

function outletMetric(outlet: OutletPerformance, kpi: KpiKey): number {
  switch (kpi) {
    case "positive":
      return outlet.positives;
    case "negative":
    case "complaints":
      return outlet.negatives;
    case "escalations":
      return outlet.escalations;
    case "sentiment":
      return Number(outlet.avg_sentiment.toFixed(2));
    case "duration":
      return Math.round(outlet.avg_duration);
    default:
      return outlet.conversations;
  }
}

export function DrillDownDialog({
  drill,
  overview,
  onOpenChange,
}: {
  drill: DrillDown | null;
  overview: ExecutiveOverview;
  onOpenChange: (open: boolean) => void;
}) {
  const isKpi = drill?.kind === "kpi" && drill.kpi;
  const outlet = drill?.outlet;

  const data = isKpi
    ? overview.outlets
        .map((o) => ({ label: o.code || o.name, value: outletMetric(o, drill.kpi!) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12)
    : [];

  return (
    <Dialog open={Boolean(drill)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        {isKpi && (
          <>
            <DialogHeader>
              <DialogTitle>{KPI_TITLES[drill.kpi!]} by outlet</DialogTitle>
              <DialogDescription>
                Breakdown across the top performing outlets for the current filter selection.
              </DialogDescription>
            </DialogHeader>
            <CategoryBarChart data={data} height={300} valueName={KPI_TITLES[drill.kpi!]} />
            <div className="flex justify-end">
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link to="/conversationiq">
                  Open ConversationIQ
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </div>
          </>
        )}

        {outlet && (
          <>
            <DialogHeader>
              <DialogTitle>{outlet.name}</DialogTitle>
              <DialogDescription>
                {[outlet.code, outlet.city, outlet.region].filter(Boolean).join(" · ")}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Conversations", value: formatNumber(outlet.conversations) },
                { label: "Avg sentiment", value: outlet.avg_sentiment.toFixed(2) },
                { label: "Positive rate", value: `${outlet.positive_rate.toFixed(0)}%` },
                { label: "Complaint rate", value: `${outlet.complaint_rate.toFixed(0)}%` },
                { label: "Escalations", value: String(outlet.escalations) },
                { label: "Risk score", value: outlet.risk_score.toFixed(0) },
                { label: "Overall score", value: outlet.overall_score.toFixed(0) },
                {
                  label: "Avg duration",
                  value: `${Math.floor(outlet.avg_duration / 60)}m ${Math.round(outlet.avg_duration % 60)}s`,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-border/70 bg-surface/40 p-3"
                >
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex justify-end gap-2">
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link to="/outlets">
                  Outlet management
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="sm" className="gap-2">
                <Link to="/conversationiq">
                  Review conversations
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
