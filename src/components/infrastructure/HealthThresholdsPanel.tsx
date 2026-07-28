import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Gauge, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ErrorState, LoadingState, Panel, StatusPill } from "@/components/common/Primitives";
import { useInfraAccess } from "@/features/infrastructure/access";
import { audioStreamsQuery } from "@/features/infrastructure/queries";
import {
  METRIC_HINTS,
  breachTone,
  evaluateInfraHealth,
  evaluateReading,
  thresholdsQuery,
  updateThreshold,
  validateThreshold,
  type HealthThreshold,
} from "@/features/infrastructure/thresholds";

/**
 * Threshold editor plus live breach counters.
 *
 * The same limits are evaluated in the database, which raises an in-app alert
 * (deduplicated per device, metric and hour) whenever a stream crosses them.
 * The sweep runs automatically every five minutes while this page is open.
 */
export function HealthThresholdsPanel() {
  const access = useInfraAccess();
  const queryClient = useQueryClient();
  const { data, isPending, error, refetch } = useQuery(thresholdsQuery);
  const streams = useQuery(audioStreamsQuery);

  const breaches = useMemo(() => {
    const rows = streams.data ?? [];
    const map = new Map<string, { warn: number; critical: number }>();
    for (const threshold of data ?? []) {
      let warn = 0;
      let critical = 0;
      for (const stream of rows) {
        const level = evaluateReading(threshold, {
          latency_ms: Number(stream.latency_ms),
          packet_loss: Number(stream.packet_loss),
          noise_floor_db: Number(stream.noise_floor_db),
          signal_quality: Number(stream.signal_quality),
        });
        if (level === "critical") critical += 1;
        else if (level === "warn") warn += 1;
      }
      map.set(threshold.id, { warn, critical });
    }
    return map;
  }, [data, streams.data]);

  const sweep = useMutation({
    mutationFn: evaluateInfraHealth,
    onSuccess: (count) => {
      if (count > 0) {
        toast.warning(`${count} threshold breach${count === 1 ? "" : "es"} raised as alerts`);
        queryClient.invalidateQueries({ queryKey: ["alerts"] });
      }
      queryClient.invalidateQueries({ queryKey: ["infrastructure", "events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Automated monitoring: sweep on mount, then every five minutes.
  const runSweep = sweep.mutate;
  useEffect(() => {
    runSweep();
    const id = window.setInterval(() => runSweep(), 5 * 60_000);
    return () => window.clearInterval(id);
  }, [runSweep]);

  return (
    <Panel
      title="Health thresholds"
      description="Warning and critical limits for latency, packet loss, noise floor and signal quality. Breaches raise an in-app alert automatically."
      actions={
        <Button
          size="sm"
          variant="outline"
          disabled={sweep.isPending}
          onClick={() => sweep.mutate()}
        >
          {sweep.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Run check now
        </Button>
      }
    >
      {!access.can("configureThresholds") && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            You can see the configured limits and live breaches. Only workspace admins can change
            them.
          </p>
        </div>
      )}

      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : isPending ? (
        <LoadingState rows={4} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(data ?? []).map((threshold) => (
            <ThresholdCard
              key={threshold.id}
              threshold={threshold}
              readonly={!access.can("configureThresholds")}
              breach={breaches.get(threshold.id) ?? { warn: 0, critical: 0 }}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function ThresholdCard({
  threshold,
  readonly,
  breach,
}: {
  threshold: HealthThreshold;
  readonly: boolean;
  breach: { warn: number; critical: number };
}) {
  const queryClient = useQueryClient();
  const [warn, setWarn] = useState(String(threshold.warn_value));
  const [critical, setCritical] = useState(String(threshold.critical_value));

  useEffect(() => {
    setWarn(String(threshold.warn_value));
    setCritical(String(threshold.critical_value));
  }, [threshold.warn_value, threshold.critical_value]);

  const save = useMutation({
    mutationFn: async (patch: {
      warn_value?: number;
      critical_value?: number;
      enabled?: boolean;
    }) => {
      const problem = validateThreshold(threshold, patch);
      if (problem) throw new Error(problem);
      await updateThreshold(threshold.id, patch);
    },
    onSuccess: () => {
      toast.success(`${threshold.label} limits updated`);
      queryClient.invalidateQueries({ queryKey: ["infrastructure", "thresholds"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setWarn(String(threshold.warn_value));
      setCritical(String(threshold.critical_value));
    },
  });

  const dirty =
    Number(warn) !== threshold.warn_value || Number(critical) !== threshold.critical_value;

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Gauge className="size-4 text-primary" /> {threshold.label}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {METRIC_HINTS[threshold.metric] ?? ""}
          </p>
        </div>
        <Switch
          checked={threshold.enabled}
          disabled={readonly || save.isPending}
          aria-label={`Enable ${threshold.label} monitoring`}
          onCheckedChange={(checked) => save.mutate({ enabled: checked })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">
            Warning {threshold.comparator === "above" ? "at or above" : "at or below"}
          </Label>
          <Input
            value={warn}
            inputMode="decimal"
            disabled={readonly}
            className="h-8 bg-surface text-xs"
            onChange={(event) => setWarn(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">
            Critical {threshold.comparator === "above" ? "at or above" : "at or below"}
          </Label>
          <Input
            value={critical}
            inputMode="decimal"
            disabled={readonly}
            className="h-8 bg-surface text-xs"
            onChange={(event) => setCritical(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <StatusPill
            label={`${breach.critical} critical`}
            tone={breachTone(breach.critical > 0 ? "critical" : "ok")}
          />
          <StatusPill
            label={`${breach.warn} warning`}
            tone={breachTone(breach.warn > 0 ? "warn" : "ok")}
          />
          <span className="text-muted-foreground">
            streams breaching now · unit {threshold.unit || "—"}
          </span>
        </div>
        {!readonly && dirty && (
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({ warn_value: Number(warn), critical_value: Number(critical) })
            }
          >
            {save.isPending ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : (
              <AlertTriangle className="mr-2 size-3.5" />
            )}
            Apply limits
          </Button>
        )}
      </div>
    </div>
  );
}
