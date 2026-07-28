import { useCallback, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { ErrorState, PageHeader } from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterBar } from "@/components/command-centre/FilterBar";
import { KpiGrid, KpiGridSkeleton, type KpiKey } from "@/components/command-centre/KpiGrid";
import {
  ExecutiveSummary,
  InsightCards,
  RecommendationCards,
} from "@/components/command-centre/ExecutivePanels";
import {
  CxScoreGauge,
  RegionalComparison,
  SentimentOverview,
} from "@/components/command-centre/SentimentWidgets";
import { OutletMap, OutletPerformanceTable } from "@/components/command-centre/OutletWidgets";
import {
  ActivityFeed,
  AlertOverview,
  KeywordCloud,
  LanguageAnalytics,
  TopIssues,
} from "@/components/command-centre/AnalyticsWidgets";
import { ExportMenu } from "@/components/command-centre/ExportMenu";
import { ExportHistory } from "@/components/command-centre/ExportHistory";
import { LiveStatusPanel } from "@/components/command-centre/LiveStatusPanel";
import { WidgetDeepLink } from "@/components/command-centre/WidgetDeepLink";
import { DashboardAuditTrail } from "@/components/command-centre/DashboardAuditTrail";
import { ScheduledReports } from "@/components/command-centre/ScheduledReports";
import { DashboardSettings } from "@/components/command-centre/DashboardSettings";
import { DrillDownDialog, type DrillDown } from "@/components/command-centre/DrillDownDialog";
import {
  defaultFilters,
  rangeLabel,
  toggleValue,
  type CommandFilters,
} from "@/features/command-centre/filters";
import {
  dashboardLayoutQuery,
  executiveOverviewQuery,
  type DashboardLayout,
} from "@/features/command-centre/queries";
import { resolveOrder, WIDGETS } from "@/features/command-centre/widgets";
import { useCommandCentreRealtime } from "@/features/command-centre/realtime";
import { useWidgetAccess } from "@/features/command-centre/widgetAccess";
import { getActiveTenant } from "@/features/platform/queries";
import type { ExecutiveOverview, OutletPerformance } from "@/features/command-centre/types";

export const Route = createFileRoute("/_authenticated/command-centre")({
  head: () => ({
    meta: [
      { title: "Executive Command Centre — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Real-time executive intelligence on customer experience health: CX score, sentiment, outlet ranking, alerts and AI recommendations across every region.",
      },
      { property: "og:title", content: "Executive Command Centre — AegisIQ CX™" },
      {
        property: "og:description",
        content:
          "Understand the health of the organisation in seconds: CX score, sentiment trends, outlet ranking and AI recommendations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommandCentrePage,
});

const FALLBACK_LAYOUT: DashboardLayout = {
  hidden_widgets: [],
  widget_order: [],
  refresh_interval_seconds: 60,
  auto_refresh: true,
};

function WidgetSkeleton({ height = 320 }: { height?: number }) {
  return <Skeleton className="w-full rounded-xl bg-muted/50" style={{ height }} />;
}

const WIDGET_LABELS = new Map(WIDGETS.map((w) => [w.id, w.label]));

function CommandCentrePage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<CommandFilters>(() => defaultFilters());
  const [drill, setDrill] = useState<DrillDown | null>(null);

  const realtime = useCommandCentreRealtime(getActiveTenant());

  const layoutQuery = useQuery(dashboardLayoutQuery);
  const layout = layoutQuery.data ?? FALLBACK_LAYOUT;

  const overviewQuery = useQuery({
    ...executiveOverviewQuery(filters),
    refetchInterval: layout.auto_refresh ? layout.refresh_interval_seconds * 1000 : false,
  });
  const overview = overviewQuery.data;

  const order = useMemo(() => resolveOrder(layout.widget_order), [layout.widget_order]);
  const hidden = useMemo(() => new Set(layout.hidden_widgets), [layout.hidden_widgets]);

  const openOutlet = useCallback((outlet: OutletPerformance) => {
    setDrill({ kind: "outlet", outlet });
  }, []);

  const openConversation = useCallback(
    (id: string) => {
      void navigate({ to: "/conversationiq/$conversationId", params: { conversationId: id } });
    },
    [navigate],
  );

  const renderWidget = (id: string, data: ExecutiveOverview) => {
    switch (id) {
      case "kpis":
        return (
          <KpiGrid kpis={data.kpis} onDrillDown={(kpi: KpiKey) => setDrill({ kind: "kpi", kpi })} />
        );
      case "summary":
        return <ExecutiveSummary overview={data} />;
      case "score":
        return <CxScoreGauge overview={data} />;
      case "sentiment":
        return <SentimentOverview overview={data} />;
      case "outlets":
        return <OutletPerformanceTable outlets={data.outlets} onSelect={openOutlet} />;
      case "map":
        return <OutletMap outlets={data.outlets} onSelect={openOutlet} />;
      case "languages":
        return (
          <LanguageAnalytics
            overview={data}
            onSelect={(code) =>
              setFilters((prev) => ({ ...prev, languages: toggleValue(prev.languages, code) }))
            }
          />
        );
      case "keywords":
        return (
          <KeywordCloud
            overview={data}
            onSelect={(term) =>
              setFilters((prev) => ({ ...prev, keywords: toggleValue(prev.keywords, term) }))
            }
          />
        );
      case "alerts":
        return <AlertOverview overview={data} />;
      case "issues":
        return <TopIssues overview={data} />;
      case "regions":
        return <RegionalComparison overview={data} />;
      case "recommendations":
        return <RecommendationCards overview={data} />;
      case "insights":
        return <InsightCards overview={data} />;
      case "activity":
        return <ActivityFeed overview={data} onOpenConversation={openConversation} />;
      default:
        return null;
    }
  };

  // Two-column widgets sit side by side on wide screens; the rest span full width.
  const HALF_WIDTH = new Set([
    "score",
    "languages",
    "keywords",
    "alerts",
    "issues",
    "map",
    "activity",
  ]);

  const visible = order.filter((id) => !hidden.has(id));

  return (
    <>
      <FilterBar
        filters={filters}
        options={
          overview?.filterOptions ?? {
            regions: [],
            outlets: [],
            languages: [],
            topics: [],
            employees: [],
            keywords: [],
            alertTypes: [],
          }
        }
        onChange={setFilters}
      />

      <PageHeader
        title="Executive Command Centre"
        description="Organisation-wide customer experience intelligence for executive decision making."
        actions={
          <>
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              {rangeLabel(filters)}
              {overview &&
                ` · updated ${new Date(overview.generatedAt).toLocaleTimeString("en-GB")}`}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void overviewQuery.refetch()}
              disabled={overviewQuery.isFetching}
            >
              <RefreshCw className={overviewQuery.isFetching ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>
            <Badge
              variant="outline"
              className={
                realtime.connected
                  ? "gap-1.5 text-[11px] text-emerald-400"
                  : "gap-1.5 text-[11px] text-muted-foreground"
              }
            >
              <span
                className={
                  realtime.connected
                    ? "size-1.5 rounded-full bg-emerald-400"
                    : "size-1.5 rounded-full bg-muted-foreground"
                }
              />
              {realtime.connected ? "Live" : "Offline"}
              {realtime.events > 0 && ` · ${realtime.events}`}
            </Badge>
            <ExportMenu overview={overview} filters={filters} />
            <ScheduledReports />
            <DashboardAuditTrail />
            <DashboardSettings layout={layout} />
          </>
        }
      />

      {overviewQuery.isError && (
        <ErrorState
          message={
            overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "Could not load the executive overview."
          }
          onRetry={() => void overviewQuery.refetch()}
        />
      )}

      {overviewQuery.isLoading && (
        <div className="space-y-4">
          <KpiGridSkeleton />
          <WidgetSkeleton height={180} />
          <div className="grid gap-4 xl:grid-cols-2">
            <WidgetSkeleton />
            <WidgetSkeleton />
          </div>
        </div>
      )}

      {overview && (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((id) => (
            <section
              key={id}
              className={
                HALF_WIDTH.has(id)
                  ? "group relative min-w-0"
                  : "group relative min-w-0 xl:col-span-2"
              }
            >
              {renderWidget(id, overview)}
              <WidgetDeepLink
                widgetId={id}
                filters={filters}
                label={`Open ${WIDGET_LABELS.get(id) ?? id} in ConversationIQ`}
                className="absolute right-3 top-3 z-10 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              />
            </section>
          ))}
        </div>
      )}

      {overview && (
        <DrillDownDialog
          drill={drill}
          overview={overview}
          onOpenChange={(open) => !open && setDrill(null)}
        />
      )}
    </>
  );
}
