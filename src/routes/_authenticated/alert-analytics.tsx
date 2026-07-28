import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, Download, FileText, Gauge, ShieldAlert, Siren, Timer, Zap } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  MetricCard,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryBarChart, DonutChart, TrendAreaChart } from "@/components/command-centre/charts";
import { outletsQuery } from "@/features/platform/queries";
import type { AppRole } from "@/features/platform/queries";
import {
  ALERT_SEVERITIES,
  alertLifecycleQuery,
  alertSlaPoliciesQuery,
  buildAlertAnalytics,
  describeMinutes,
  recentEscalationsQuery,
  runEscalationSweep,
  saveAlertSlaPolicy,
} from "@/features/alerts/sla";
import { useAlertAccess } from "@/features/alerts/access";
import { exportAlertAnalytics } from "@/features/alerts/exportAnalytics";
import { useEscalationNotifications } from "@/features/alerts/escalationNotifications";
import { formatNumber, formatRelative, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/alert-analytics")({
  head: () => ({
    meta: [
      { title: "Alert Analytics & SLA — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Track alert volume, severity mix, MTTA and MTTR by outlet, and configure SLA timers with automatic escalation to backup owners.",
      },
      { property: "og:title", content: "Alert Analytics & SLA — AegisIQ CX™" },
      {
        property: "og:description",
        content: "MTTA/MTTR metrics, breach tracking and configurable alert escalation policies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlertAnalyticsPage,
});

const BACKUP_ROLES: AppRole[] = [
  "tenant_admin",
  "regional_manager",
  "outlet_manager",
  "supervisor",
];
const NO_ROLE = "__none__";

function minutesLabel(value: number | null): string {
  if (value === null) return "—";
  return describeMinutes(value);
}

function AlertAnalyticsPage() {
  const access = useAlertAccess();
  const alerts = useQuery(alertLifecycleQuery);
  const outlets = useQuery(outletsQuery);
  const policies = useQuery(alertSlaPoliciesQuery);
  const escalations = useQuery(recentEscalationsQuery);
  useEscalationNotifications({ enabled: true });
  const queryClient = useQueryClient();
  const [windowDays, setWindowDays] = useState("30");

  const outletName = useMemo(() => {
    const map = new Map((outlets.data ?? []).map((o) => [o.id, o.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Estate-wide") : "Estate-wide");
  }, [outlets.data]);

  const analytics = useMemo(
    () => buildAlertAnalytics(alerts.data ?? [], outletName, Number(windowDays)),
    [alerts.data, outletName, windowDays],
  );

  const sweep = useMutation({
    mutationFn: runEscalationSweep,
    onSuccess: (count) => {
      toast.success(
        count === 0 ? "No alerts are overdue right now" : `${count} alerts escalated to backups`,
      );
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!access.isLoading && !access.canViewAnalytics) {
    return (
      <div>
        <PageHeader title="Alert Analytics" description="Alert performance for your estate." />
        <EmptyState
          title="You don't have access to alert analytics"
          description="Ask a workspace administrator to grant the alert analytics capability to your role."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Alert Analytics & SLA"
        description="Response performance across the estate, with configurable SLA timers and automatic escalation to backup owners."
        actions={
          <div className="flex items-center gap-2">
            <Select value={windowDays} onValueChange={setWindowDays}>
              <SelectTrigger className="h-9 w-[130px] bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={analytics.total === 0}
              onClick={() => {
                exportAlertAnalytics("csv", analytics, { windowDays: Number(windowDays) });
                toast.success("Alert analytics CSV downloaded");
              }}
            >
              <Download className="mr-2 size-4" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={analytics.total === 0}
              onClick={() => {
                try {
                  exportAlertAnalytics("pdf", analytics, { windowDays: Number(windowDays) });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Export failed");
                }
              }}
            >
              <FileText className="mr-2 size-4" /> PDF
            </Button>
            <Button size="sm" disabled={sweep.isPending} onClick={() => sweep.mutate()}>
              <Zap className="mr-2 size-4" /> Run escalation sweep
            </Button>
          </div>
        }
      />

      {alerts.isPending ? (
        <LoadingState rows={6} />
      ) : alerts.error ? (
        <ErrorState message={alerts.error.message} onRetry={() => void alerts.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Alerts raised"
              value={formatNumber(analytics.total)}
              hint={`${formatNumber(analytics.open)} still open`}
              icon={Siren}
              index={0}
            />
            <MetricCard
              label="MTTA"
              value={minutesLabel(analytics.mtta)}
              hint="Mean time to acknowledge"
              icon={AlarmClock}
              index={1}
            />
            <MetricCard
              label="MTTR"
              value={minutesLabel(analytics.mttr)}
              hint="Mean time to resolve"
              icon={Gauge}
              index={2}
            />
            <MetricCard
              label="SLA breaches"
              value={formatNumber(analytics.breached)}
              hint={`${formatNumber(analytics.escalated)} escalated to backups`}
              icon={ShieldAlert}
              index={3}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Panel
                title="Alert volume trend"
                description="Total alerts per day with critical and high severity overlaid"
              >
                <TrendAreaChart
                  data={analytics.trend}
                  valueName="Alerts"
                  secondaryName="Critical / high"
                />
              </Panel>
            </div>
            <Panel title="Severity mix" description="Distribution across the selected window">
              {analytics.bySeverity.length === 0 ? (
                <EmptyState
                  title="No alerts in this window"
                  description="Widen the reporting window to see the severity mix."
                />
              ) : (
                <DonutChart data={analytics.bySeverity} />
              )}
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Panel title="Alerts by outlet" description="Top 10 outlets by alert volume">
              {analytics.byOutlet.length === 0 ? (
                <EmptyState
                  title="No outlet activity yet"
                  description="Alerts will appear here once outlets start raising signals."
                />
              ) : (
                <CategoryBarChart data={analytics.byOutlet} valueName="Alerts" />
              )}
            </Panel>
            <Panel title="Outlet response performance" description="Breach count and MTTR by site">
              {analytics.byOutlet.length === 0 ? (
                <EmptyState
                  title="No outlet activity yet"
                  description="Alerts will appear here once outlets start raising signals."
                />
              ) : (
                <ul className="space-y-2">
                  {analytics.byOutlet.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/50 px-3 py-2.5"
                    >
                      <span className="min-w-0 truncate text-sm">{row.label}</span>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">{formatNumber(row.value)} alerts</span>
                        <span className="tabular-nums">MTTR {minutesLabel(row.mttr)}</span>
                        <StatusPill
                          label={`${row.breached} breached`}
                          tone={row.breached > 0 ? "negative" : "positive"}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="mt-4">
            <SlaPolicyPanel canEdit={access.canManageSla} />
          </div>

          <div className="mt-4">
            <Panel
              title="Recent escalations"
              description="Automatic hand-offs triggered when an alert passed its threshold"
            >
              {(escalations.data ?? []).length === 0 ? (
                <EmptyState
                  title="No escalations recorded"
                  description="Alerts are being acknowledged and resolved inside their SLA windows."
                />
              ) : (
                <ul className="space-y-2">
                  {(escalations.data ?? []).slice(0, 12).map((event) => (
                    <li
                      key={event.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2.5 text-xs"
                    >
                      <ShieldAlert className="size-3.5 text-destructive" />
                      <span className="font-medium">Level {event.level}</span>
                      <span className="text-muted-foreground">{event.reason}</span>
                      <span className="text-muted-foreground">
                        → {event.to_user_name ?? (event.to_role ? titleCase(event.to_role) : "backup owner")}
                      </span>
                      <span className="ml-auto text-muted-foreground">
                        {describeMinutes(event.minutes_overdue)} overdue ·{" "}
                        {formatRelative(event.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

/** Per-severity SLA timers and the backup owner alerts escalate to. */
function SlaPolicyPanel({ canEdit }: { canEdit: boolean }) {
  const policies = useQuery(alertSlaPoliciesQuery);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: saveAlertSlaPolicy,
    onSuccess: () => {
      toast.success("SLA policy updated");
      void queryClient.invalidateQueries({ queryKey: ["alerts", "sla-policies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel
      title="SLA timers & escalation"
      description={
        canEdit
          ? "Acknowledge and resolve targets per severity, with the backup owner alerts escalate to."
          : "Acknowledge and resolve targets per severity. Only admins and regional managers can change these."
      }
    >
      {policies.isPending ? (
        <LoadingState rows={3} />
      ) : (
        <div className="space-y-2">
          {ALERT_SEVERITIES.map((severity) => {
            const policy = policies.data?.get(severity);
            if (!policy) return null;
            const update = (patch: Partial<typeof policy>) =>
              save.mutate({ ...policy, ...patch });
            return (
              <div
                key={severity}
                className="grid gap-3 rounded-lg border border-border bg-surface/50 px-3 py-3 lg:grid-cols-[120px_repeat(3,1fr)_1.2fr_auto] lg:items-center"
              >
                <div className="flex items-center gap-2">
                  <Timer className="size-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium capitalize">{severity}</span>
                </div>
                <NumberField
                  label="Acknowledge (min)"
                  value={policy.ack_minutes}
                  disabled={!canEdit}
                  onCommit={(v) => update({ ack_minutes: v })}
                />
                <NumberField
                  label="Resolve (min)"
                  value={policy.resolve_minutes}
                  disabled={!canEdit}
                  onCommit={(v) => update({ resolve_minutes: v })}
                />
                <NumberField
                  label="Escalate after (min)"
                  value={policy.escalate_after_minutes}
                  disabled={!canEdit}
                  onCommit={(v) => update({ escalate_after_minutes: v })}
                />
                <label className="block">
                  <span className="mb-1 block text-[11px] text-muted-foreground">Backup owner role</span>
                  <Select
                    value={policy.backup_role ?? NO_ROLE}
                    disabled={!canEdit}
                    onValueChange={(v) =>
                      update({ backup_role: v === NO_ROLE ? null : (v as AppRole) })
                    }
                  >
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ROLE}>No backup</SelectItem>
                      {BACKUP_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {titleCase(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex items-center gap-2 lg:justify-end">
                  <Switch
                    checked={policy.is_active}
                    disabled={!canEdit}
                    onCheckedChange={(v) => update({ is_active: v })}
                  />
                  <span className="text-[11px] text-muted-foreground">Active</span>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function NumberField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={1}
        className="h-9 bg-background"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = Number(draft);
          if (!Number.isFinite(next) || next < 1) {
            setDraft(String(value));
            return;
          }
          if (next !== value) onCommit(next);
        }}
      />
    </label>
  );
}
