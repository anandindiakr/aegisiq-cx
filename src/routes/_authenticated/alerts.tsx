import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck, CheckCircle2, Mail, MailOpen } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  alertReadsQuery,
  alertsQuery,
  markAlertsRead,
  markAlertUnread,
  outletsQuery,
  updateAlertStatus,
} from "@/features/platform/queries";
import type { AlertStatus } from "@/features/platform/queries";
import { formatDateTime, formatNumber, titleCase } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Triage customer experience alerts by severity, outlet and status with full acknowledgement trail.",
      },
      { property: "og:title", content: "Alerts — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Triage customer experience alerts across your estate in real time.",
      },
    ],
  }),
  component: AlertsPage,
});

const SEVERITY_TONE: Record<string, "negative" | "warning" | "info" | "neutral"> = {
  critical: "negative",
  high: "negative",
  medium: "warning",
  low: "info",
  info: "neutral",
};

function AlertsPage() {
  const { data, isPending, error, refetch } = useQuery(alertsQuery);
  const outlets = useQuery(outletsQuery);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"all" | AlertStatus>("open");

  const acknowledge = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AlertStatus }) =>
      updateAlertStatus(id, status),
    onSuccess: () => {
      toast.success("Alert updated");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const outletName = useMemo(() => {
    const map = new Map((outlets.data ?? []).map((o) => [o.id, o.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Estate-wide") : "Estate-wide");
  }, [outlets.data]);

  const rows = (data ?? []).filter((a) => (tab === "all" ? true : a.status === tab));

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Signals raised by sentiment thresholds, escalation keywords and operational anomalies."
      />

      <Panel
        title={`${formatNumber(rows.length)} alerts`}
        description="Ordered by most recent trigger time"
        actions={
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="bg-surface">
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isPending ? (
          <LoadingState rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No alerts in this queue"
            description="Nothing requires attention with the current filter. New signals appear here automatically."
          />
        ) : (
          <ul className="space-y-3">
            {rows.slice(0, 60).map((alert) => (
              <li
                key={alert.id}
                className="rounded-xl border border-border bg-surface/60 p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill
                        label={alert.severity}
                        tone={SEVERITY_TONE[alert.severity] ?? "neutral"}
                      />
                      <StatusPill
                        label={alert.status}
                        tone={alert.status === "resolved" ? "positive" : "neutral"}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {titleCase(alert.category)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium">{alert.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{alert.description}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {outletName(alert.outlet_id)} · {formatDateTime(alert.triggered_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {alert.status === "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acknowledge.isPending}
                        onClick={() => acknowledge.mutate({ id: alert.id, status: "acknowledged" })}
                      >
                        Acknowledge
                      </Button>
                    )}
                    {alert.status !== "resolved" && (
                      <Button
                        size="sm"
                        disabled={acknowledge.isPending}
                        onClick={() => acknowledge.mutate({ id: alert.id, status: "resolved" })}
                      >
                        <CheckCircle2 className="mr-2 size-4" /> Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
