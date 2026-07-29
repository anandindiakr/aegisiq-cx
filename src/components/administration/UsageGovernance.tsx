/**
 * Usage governance surfaces: CSV export, scheduled report downloads,
 * threshold / throttle / anomaly rules and the events they raise.
 *
 * The watcher runs the server-side evaluator on an interval, raises an in-app
 * toast for anything new and fans the same event out to the configured
 * notification channels (tenant admins and the platform super admin).
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Download, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notify } from "@/features/command-centre/notificationChannels";
import {
  KIND_LABELS,
  METRIC_LABELS,
  USAGE_METRICS,
  acknowledgeUsageEvent,
  deleteUsageSchedule,
  evaluateUsageAlerts,
  exportUsageCsv,
  runUsageScheduleNow,
  saveUsageAlertRule,
  saveUsageSchedule,
  usageAlertEventsQuery,
  usageAlertRulesQuery,
  usageSchedulesQuery,
  type ScheduleFrequency,
  type UsageAlertEvent,
  type UsageAlertRule,
  type UsageMetric,
  type UsageReportSchedule,
} from "@/features/administration/usageAlerts";

const EVALUATE_MS = 120_000;

/* ------------------------------------------------------------------ */
/* Watcher — evaluate, toast, notify                                   */
/* ------------------------------------------------------------------ */

const EVENT_TYPE = {
  threshold: "usage.threshold",
  throttle: "usage.throttled",
  anomaly: "usage.anomaly",
} as const;

export function useUsageAlertWatcher(enabled = true) {
  const client = useQueryClient();
  const events = useQuery({
    ...usageAlertEventsQuery,
    enabled,
    refetchInterval: enabled ? EVALUATE_MS : false,
  });
  const seen = useRef<Set<string> | null>(null);

  // Ask the database to re-evaluate thresholds, throttling and anomalies.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const run = async () => {
      try {
        const created = await evaluateUsageAlerts();
        if (created > 0 && !cancelled) {
          await client.invalidateQueries({ queryKey: ["usage", "alert-events"] });
        }
      } catch {
        /* evaluation must never break the dashboard */
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), EVALUATE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client, enabled]);

  const rows = events.data;
  useEffect(() => {
    if (!rows) return;
    if (seen.current === null) {
      seen.current = new Set(rows.map((r) => r.id));
      return;
    }
    const fresh = rows.filter((r) => !seen.current!.has(r.id));
    for (const event of fresh.slice().reverse()) {
      seen.current.add(event.id);
      const title = `${KIND_LABELS[event.kind]} — ${METRIC_LABELS[event.metric]}`;
      if (event.severity === "critical") toast.error(title, { description: event.message });
      else toast.warning(title, { description: event.message });
      void notify(
        EVENT_TYPE[event.kind],
        title,
        event.message,
        {
          metric: event.metric,
          outlet: event.outlet_name,
          observed: event.observed,
          baseline: event.baseline,
          limit: event.limit_value,
          pct: event.pct,
        },
        { dedupeKey: `usage:${event.id}` },
      );
    }
  }, [rows]);

  return {
    events: rows ?? [],
    unacknowledged: (rows ?? []).filter((e) => !e.acknowledged_at).length,
  };
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export function UsageExportButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const rows = await exportUsageCsv();
          toast.success("Usage exported", { description: `${rows} rows written to CSV.` });
        } catch (error) {
          toast.error("Export failed", { description: (error as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download className="mr-2 size-4" />
      Export CSV
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Alert rules                                                         */
/* ------------------------------------------------------------------ */

const DEFAULT_RULE: Omit<UsageAlertRule, "id" | "company_id" | "metric"> = {
  enabled: true,
  warn_pct: 80,
  critical_pct: 100,
  spike_multiplier: 3,
  min_baseline: 20,
  notify_tenant_admins: true,
  notify_super_admin: true,
};

function RuleRow({ metric, rule }: { metric: UsageMetric; rule?: UsageAlertRule }) {
  const client = useQueryClient();
  const value = { ...DEFAULT_RULE, ...(rule ?? {}) };
  const save = useMutation({
    mutationFn: (patch: Partial<UsageAlertRule>) =>
      saveUsageAlertRule(metric, { ...value, ...patch }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["usage", "alert-rules"] });
      toast.success(`${METRIC_LABELS[metric]} rule saved`);
    },
    onError: (error: Error) => toast.error("Could not save rule", { description: error.message }),
  });

  return (
    <div className="grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_repeat(4,90px)_auto] sm:items-end">
      <div>
        <p className="text-sm font-medium">{METRIC_LABELS[metric]}</p>
        <p className="text-xs text-muted-foreground">
          Warn, block and spike sensitivity for this meter
        </p>
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Warn %</Label>
        <Input
          type="number"
          className="h-8"
          defaultValue={value.warn_pct}
          onBlur={(e) => save.mutate({ warn_pct: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Critical %</Label>
        <Input
          type="number"
          className="h-8"
          defaultValue={value.critical_pct}
          onBlur={(e) => save.mutate({ critical_pct: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Spike ×</Label>
        <Input
          type="number"
          step="0.5"
          className="h-8"
          defaultValue={value.spike_multiplier}
          onBlur={(e) => save.mutate({ spike_multiplier: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Min base</Label>
        <Input
          type="number"
          className="h-8"
          defaultValue={value.min_baseline}
          onBlur={(e) => save.mutate({ min_baseline: Number(e.target.value) })}
        />
      </div>
      <div className="flex items-center gap-2 pb-1">
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) => save.mutate({ enabled })}
          aria-label={`Enable ${METRIC_LABELS[metric]} rule`}
        />
        <span className="text-xs text-muted-foreground">{value.enabled ? "On" : "Off"}</span>
      </div>
    </div>
  );
}

export function UsageAlertRulesPanel() {
  const { data, isPending, error, refetch } = useQuery(usageAlertRulesQuery);
  return (
    <Panel
      title="Usage alert rules"
      description="Thresholds that warn tenant admins, plus the spike sensitivity used for anomaly detection"
    >
      {isPending ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-3">
          {USAGE_METRICS.map((metric) => (
            <RuleRow key={metric} metric={metric} rule={data?.find((r) => r.metric === metric)} />
          ))}
          <p className="text-xs text-muted-foreground">
            A spike is raised when today&apos;s consumption exceeds the trailing 14-day average by
            the multiplier, provided the baseline is at least the minimum shown.
          </p>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

function EventRow({ event }: { event: UsageAlertEvent }) {
  const client = useQueryClient();
  const ack = useMutation({
    mutationFn: () => acknowledgeUsageEvent(event.id),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["usage", "alert-events"] }),
    onError: (error: Error) => toast.error("Could not acknowledge", { description: error.message }),
  });

  return (
    <div className="flex items-start gap-3 border-b border-border/60 py-3 last:border-0">
      <AlertTriangle
        className={
          event.severity === "critical"
            ? "mt-0.5 size-4 text-destructive"
            : "mt-0.5 size-4 text-amber-400"
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill
            label={KIND_LABELS[event.kind]}
            tone={event.severity === "critical" ? "negative" : "warning"}
          />
          <span className="text-sm font-medium">{METRIC_LABELS[event.metric]}</span>
          {event.outlet_name ? (
            <span className="text-xs text-muted-foreground">{event.outlet_name}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Workspace</span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{event.message}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {new Date(event.created_at).toLocaleString("en-SG")}
          {event.acknowledged_at ? " · acknowledged" : ""}
        </p>
      </div>
      {!event.acknowledged_at && (
        <Button variant="ghost" size="sm" onClick={() => ack.mutate()} disabled={ack.isPending}>
          <Check className="mr-1.5 size-3.5" />
          Ack
        </Button>
      )}
    </div>
  );
}

export function UsageAnomalyPanel() {
  const { events } = useUsageAlertWatcher();
  const open = events.filter((e) => !e.acknowledged_at);
  return (
    <Panel
      title="Usage alerts & anomalies"
      description="Limit approaches, throttle activations and sudden spikes in queries, audio minutes or egress"
      actions={
        <StatusPill label={`${open.length} open`} tone={open.length ? "warning" : "positive"} />
      }
    >
      {events.length ? (
        <div className="max-h-[420px] overflow-y-auto pr-1">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No usage alerts"
          description="Consumption is within allowances and no spikes have been detected."
        />
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Scheduled reports                                                   */
/* ------------------------------------------------------------------ */

const FREQUENCIES: ScheduleFrequency[] = ["daily", "weekly", "monthly"];

export function UsageSchedulesPanel() {
  const client = useQueryClient();
  const { data, isPending, error, refetch } = useQuery(usageSchedulesQuery);
  const [draft, setDraft] = useState({
    name: "Monthly metering report",
    frequency: "monthly" as ScheduleFrequency,
    scope: "outlet" as "tenant" | "outlet",
    recipients: "",
    send_hour: 7,
  });

  const create = useMutation({
    mutationFn: () =>
      saveUsageSchedule({
        name: draft.name.trim(),
        frequency: draft.frequency,
        scope: draft.scope,
        format: "csv",
        send_hour: draft.send_hour,
        recipients: draft.recipients
          .split(/[,\s]+/)
          .map((r) => r.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["usage", "report-schedules"] });
      toast.success("Schedule created");
    },
    onError: (error: Error) =>
      toast.error("Could not create schedule", { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteUsageSchedule(id),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["usage", "report-schedules"] }),
  });

  const runNow = useMutation({
    mutationFn: (schedule: UsageReportSchedule) => runUsageScheduleNow(schedule),
    onSuccess: (rows) => {
      void client.invalidateQueries({ queryKey: ["usage", "report-schedules"] });
      toast.success("Report downloaded", { description: `${rows} rows in the CSV.` });
    },
    onError: (error: Error) => toast.error("Could not run report", { description: error.message }),
  });

  const toggle = useMutation({
    mutationFn: (row: UsageReportSchedule) =>
      saveUsageSchedule({ id: row.id, is_active: !row.is_active }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["usage", "report-schedules"] }),
  });

  return (
    <Panel
      title="Scheduled usage reports"
      description="Recurring CSV metering reports delivered to finance and operations recipients"
    >
      {isPending ? (
        <LoadingState rows={3} />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-border/60 p-3 md:grid-cols-[minmax(0,1.4fr)_130px_130px_100px_auto] md:items-end">
            <div>
              <Label className="text-[11px] text-muted-foreground">Name</Label>
              <Input
                className="h-8"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Frequency</Label>
              <Select
                value={draft.frequency}
                onValueChange={(v) => setDraft({ ...draft, frequency: v as ScheduleFrequency })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f[0].toUpperCase() + f.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Scope</Label>
              <Select
                value={draft.scope}
                onValueChange={(v) => setDraft({ ...draft, scope: v as "tenant" | "outlet" })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outlet">Per outlet</SelectItem>
                  <SelectItem value="tenant">Tenant roll-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Hour</Label>
              <Input
                type="number"
                min={0}
                max={23}
                className="h-8"
                value={draft.send_hour}
                onChange={(e) => setDraft({ ...draft, send_hour: Number(e.target.value) })}
              />
            </div>
            <Button
              size="sm"
              onClick={() => create.mutate()}
              disabled={create.isPending || !draft.name.trim()}
            >
              <Plus className="mr-1.5 size-4" />
              Add
            </Button>
            <div className="md:col-span-5">
              <Label className="text-[11px] text-muted-foreground">Recipients</Label>
              <Input
                className="h-8"
                placeholder="finance@company.com, ops@company.com"
                value={draft.recipients}
                onChange={(e) => setDraft({ ...draft, recipients: e.target.value })}
              />
            </div>
          </div>

          {data?.length ? (
            <div className="space-y-2">
              {data.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.frequency} · {row.scope === "tenant" ? "tenant roll-up" : "per outlet"} ·
                      CSV at {String(row.send_hour).padStart(2, "0")}:00 ·{" "}
                      {row.recipients.length ? row.recipients.join(", ") : "no recipients"}
                    </p>
                    {row.last_sent_at && (
                      <p className="text-[11px] text-muted-foreground">
                        Last run {new Date(row.last_sent_at).toLocaleString("en-SG")}
                      </p>
                    )}
                  </div>
                  <StatusPill
                    label={row.is_active ? "active" : "paused"}
                    tone={row.is_active ? "positive" : "info"}
                  />
                  <Switch
                    checked={row.is_active}
                    onCheckedChange={() => toggle.mutate(row)}
                    aria-label={`Toggle ${row.name}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runNow.mutate(row)}
                    disabled={runNow.isPending}
                  >
                    <Play className="mr-1.5 size-3.5" />
                    Download now
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(row.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No scheduled reports"
              description="Create a recurring CSV so finance receives metering without asking."
            />
          )}
        </div>
      )}
    </Panel>
  );
}
