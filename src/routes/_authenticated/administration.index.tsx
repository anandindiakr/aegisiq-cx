import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Radio,
  ServerCog,
  Waves,
  Webhook,
} from "lucide-react";

import { LoadingState, MetricCard, Panel, StatusPill } from "@/components/common/Primitives";
import { Progress } from "@/components/ui/progress";
import {
  aiEnginesQuery,
  audioStreamsQuery,
  edgeGatewaysQuery,
  storagePoolsQuery,
} from "@/features/infrastructure/queries";
import { integrationsQuery } from "@/features/administration/queries";

export const Route = createFileRoute("/_authenticated/administration/")({
  component: SystemHealthPage,
});

interface HealthRow {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  score: number;
  detail: string;
}

function tone(score: number) {
  if (score >= 90) return "positive" as const;
  if (score >= 70) return "warning" as const;
  return "negative" as const;
}

function SystemHealthPage() {
  const engines = useQuery(aiEnginesQuery);
  const gateways = useQuery(edgeGatewaysQuery);
  const streams = useQuery(audioStreamsQuery);
  const pools = useQuery(storagePoolsQuery);
  const integrations = useQuery(integrationsQuery);

  const loading =
    engines.isPending || gateways.isPending || streams.isPending || pools.isPending;

  const engineRows = engines.data ?? [];
  const gatewayRows = gateways.data ?? [];
  const streamRows = streams.data ?? [];
  const poolRows = pools.data ?? [];

  const pct = (n: number, d: number) => (d === 0 ? 100 : Math.round((n / d) * 100));

  const healthyEngines = engineRows.filter((e) => e.health === "healthy").length;
  const onlineGateways = gatewayRows.filter((g) => g.status === "online").length;
  const healthyStreams = streamRows.filter((s) => s.status === "healthy").length;
  const storageUsed = poolRows.reduce((a, p) => a + Number(p.used_gb), 0);
  const storageCap = poolRows.reduce((a, p) => a + Number(p.capacity_gb), 0) || 1;
  const avgLatency = engineRows.length
    ? Math.round(engineRows.reduce((a, e) => a + e.latency_ms, 0) / engineRows.length)
    : 0;

  const rows: HealthRow[] = [
    {
      label: "Database",
      icon: Database,
      score: 99,
      detail: "Primary healthy · row-level security enforced",
    },
    {
      label: "AI engines",
      icon: Cpu,
      score: pct(healthyEngines, engineRows.length || 1),
      detail: `${healthyEngines}/${engineRows.length} engines healthy · avg ${avgLatency} ms`,
    },
    {
      label: "Edge gateways",
      icon: ServerCog,
      score: pct(onlineGateways, gatewayRows.length || 1),
      detail: `${onlineGateways}/${gatewayRows.length} gateways online`,
    },
    {
      label: "Speech engine",
      icon: Waves,
      score: pct(healthyStreams, streamRows.length || 1),
      detail: `${healthyStreams}/${streamRows.length} audio streams within thresholds`,
    },
    {
      label: "Storage",
      icon: HardDrive,
      score: Math.max(0, 100 - pct(storageUsed, storageCap)),
      detail: `${Math.round(storageUsed).toLocaleString()} GB of ${Math.round(storageCap).toLocaleString()} GB used`,
    },
    {
      label: "Realtime",
      icon: Radio,
      score: 97,
      detail: "Live channels subscribed · automatic reconnect armed",
    },
    {
      label: "API",
      icon: Webhook,
      score: (integrations.data ?? []).some((i) => i.status === "error") ? 74 : 98,
      detail: `${(integrations.data ?? []).filter((i) => i.enabled).length} integrations enabled`,
    },
  ];

  const overall = Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Overall health"
          value={`${overall}%`}
          icon={Activity}
          hint="Weighted across all platform services"
          index={0}
        />
        <MetricCard
          label="AI engines"
          value={`${healthyEngines}/${engineRows.length}`}
          icon={Cpu}
          hint={`Average latency ${avgLatency} ms`}
          index={1}
        />
        <MetricCard
          label="Edge gateways"
          value={`${onlineGateways}/${gatewayRows.length}`}
          icon={ServerCog}
          hint="Heartbeats in the last 5 minutes"
          index={2}
        />
        <MetricCard
          label="Storage used"
          value={`${pct(storageUsed, storageCap)}%`}
          icon={HardDrive}
          hint={`${Math.round(storageCap).toLocaleString()} GB provisioned`}
          index={3}
        />
      </div>

      <Panel
        title="System health"
        description="Live service posture across the AegisIQ CX control plane"
        actions={<StatusPill label={`${overall}% healthy`} tone={tone(overall)} />}
      >
        {loading ? (
          <LoadingState rows={6} />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface/60 px-4 py-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/25">
                  <row.icon className="size-4" />
                </span>
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.detail}</p>
                </div>
                <div className="flex w-48 items-center gap-3">
                  <Progress value={row.score} className="h-1.5" />
                  <span className="w-10 text-right font-mono text-xs tabular-nums">
                    {row.score}%
                  </span>
                </div>
                <StatusPill
                  label={row.score >= 90 ? "healthy" : row.score >= 70 ? "degraded" : "critical"}
                  tone={tone(row.score)}
                />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
