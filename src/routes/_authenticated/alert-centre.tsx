import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart3, CheckCircle2, Download, Siren, UserCheck, XCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriageSheet } from "@/components/live-monitor/AlertTriageSheet";
import type { TriageAlert } from "@/components/live-monitor/AlertTriageSheet";
import {
  alertsQuery,
  companyQuery,
  myProfileQuery,
  outletsQuery,
} from "@/features/platform/queries";
import type { AlertStatus } from "@/features/platform/queries";
import { bulkUpdateAlertStatus } from "@/features/live-monitor/queries";
import { useLiveMonitorStream } from "@/features/live-monitor/stream";
import { SlaTimer } from "@/components/alerts/SlaTimer";
import { alertSlaPoliciesQuery } from "@/features/alerts/sla";
import { useAlertAccess } from "@/features/alerts/access";
import { formatDateTime, formatNumber, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/alert-centre")({
  head: () => ({
    meta: [
      { title: "Alert Centre — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Triage, assign and resolve customer experience alerts with bulk actions, owner assignment and an auditable note trail.",
      },
      { property: "og:title", content: "Alert Centre — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Enterprise alert triage with assignment, notes and bulk resolution.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlertCentrePage,
});

const SEVERITY_TONE: Record<string, "negative" | "warning" | "info" | "neutral"> = {
  critical: "negative",
  high: "negative",
  medium: "warning",
  low: "info",
  info: "neutral",
};

const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
const STATUSES: AlertStatus[] = ["open", "acknowledged", "resolved", "dismissed"];

function AlertCentrePage() {
  const company = useQuery(companyQuery);
  const alerts = useQuery(alertsQuery);
  const outlets = useQuery(outletsQuery);
  const profile = useQuery(myProfileQuery);
  const policies = useQuery(alertSlaPoliciesQuery);
  const access = useAlertAccess();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("open");
  const [outletId, setOutletId] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<TriageAlert | null>(null);

  useLiveMonitorStream({ companyId: company.data?.id, paused: false });

  const outletName = useMemo(() => {
    const map = new Map((outlets.data ?? []).map((o) => [o.id, o.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Estate-wide") : "Estate-wide");
  }, [outlets.data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ((alerts.data ?? []) as TriageAlert[]).filter((a) => {
      if (severity !== "all" && a.severity !== severity) return false;
      if (status !== "all" && a.status !== status) return false;
      if (outletId !== "all" && a.outlet_id !== outletId) return false;
      if (!term) return true;
      return `${a.title} ${a.description ?? ""} ${a.category}`.toLowerCase().includes(term);
    });
  }, [alerts.data, search, severity, status, outletId]);

  const bulk = useMutation({
    mutationFn: (next: AlertStatus) => bulkUpdateAlertStatus(selected, next),
    onSuccess: (_d, next) => {
      toast.success(`${selected.length} alerts ${next}`);
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actionable = rows.filter((r) => access.canActOn("acknowledge", r.outlet_id));
  const allSelected = actionable.length > 0 && selected.length === actionable.length;

  const exportCsv = () => {
    const header = ["Triggered", "Severity", "Status", "Category", "Outlet", "Title"];
    const lines = rows.map((a) =>
      [
        formatDateTime(a.triggered_at),
        a.severity,
        a.status,
        a.category,
        outletName(a.outlet_id),
        a.title,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alert-centre-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Alert export downloaded");
  };

  return (
    <div>
      <PageHeader
        title="Alert Centre"
        description="Triage every signal with owners, notes and bulk resolution — synchronised live with the estate."
        actions={
          <div className="flex items-center gap-2">
            {access.canViewAnalytics && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/alert-analytics">
                  <BarChart3 className="mr-2 size-4" /> Analytics & SLA
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="mr-2 size-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <Panel
        title={`${formatNumber(rows.length)} alerts in view`}
        description="Filters apply to the live-synchronised alert set"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, description or category"
            className="bg-surface"
          />
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="bg-surface">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {titleCase(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-surface">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {titleCase(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={outletId} onValueChange={setOutletId}>
            <SelectTrigger className="bg-surface">
              <SelectValue placeholder="Outlet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outlets</SelectItem>
              {(outlets.data ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selected.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/25 bg-primary/8 px-3 py-2">
            <span className="text-xs font-medium">{selected.length} selected</span>
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.isPending || !access.can("acknowledge")}
              onClick={() => bulk.mutate("acknowledged")}
            >
              <UserCheck className="mr-2 size-4" /> Acknowledge
            </Button>
            <Button
              size="sm"
              disabled={bulk.isPending || !access.can("resolve")}
              onClick={() => bulk.mutate("resolved")}
            >
              <CheckCircle2 className="mr-2 size-4" /> Resolve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={bulk.isPending || !access.can("dismiss")}
              onClick={() => bulk.mutate("dismissed")}
            >
              <XCircle className="mr-2 size-4" /> Dismiss
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        )}

        <div className="mt-4">
          {alerts.isPending ? (
            <LoadingState rows={6} />
          ) : alerts.error ? (
            <ErrorState message={alerts.error.message} onRetry={() => void alerts.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No alerts match these filters"
              description="Widen the severity, status or outlet filters to review more signals."
            />
          ) : (
            <>
              <label className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) =>
                  setSelected(
                    v
                      ? rows
                          .filter((r) => access.canActOn("acknowledge", r.outlet_id))
                          .map((r) => r.id)
                      : [],
                  )
                }
                />
                Select all in view
              </label>
              <ul className="space-y-2">
                {rows.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-surface/50 px-3 py-3"
                  >
                    <Checkbox
                      className="mt-1"
                      aria-label={`Select ${alert.title}`}
                      disabled={!access.canActOn("acknowledge", alert.outlet_id)}
                      checked={selected.includes(alert.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) =>
                          v ? [...prev, alert.id] : prev.filter((id) => id !== alert.id),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setActive(alert)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Siren className="size-3.5 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">{alert.title}</span>
                        <StatusPill
                          label={alert.severity}
                          tone={SEVERITY_TONE[alert.severity] ?? "neutral"}
                        />
                        <StatusPill label={alert.status} />
                        <SlaTimer
                          alert={alert}
                          policy={policies.data?.get(alert.severity)}
                          compact
                        />
                        {(alert.escalation_level ?? 0) > 0 && (
                          <StatusPill
                            label={`escalated L${alert.escalation_level}`}
                            tone="negative"
                          />
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {outletName(alert.outlet_id)} · {titleCase(alert.category)} ·{" "}
                        {formatDateTime(alert.triggered_at)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Panel>

      <AlertTriageSheet
        alert={active}
        outletName={outletName}
        authorName={profile.data?.full_name ?? null}
        onOpenChange={(open) => !open && setActive(null)}
      />
    </div>
  );
}
