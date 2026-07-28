import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Cctv, Cpu, ServerCog } from "lucide-react";

import { ErrorState, MetricCard, PageHeader, Panel } from "@/components/common/Primitives";
import { Progress } from "@/components/ui/progress";
import { TestCentre } from "@/components/infrastructure/TestCentre";
import { LiveLogs } from "@/components/infrastructure/LiveLogs";
import {
  aiEnginesQuery,
  audioStreamsQuery,
  edgeGatewaysQuery,
  infraCamerasQuery,
  storagePoolsQuery,
} from "@/features/infrastructure/queries";
import { buildEstateHealth } from "@/features/infrastructure/pipeline";

export const Route = createFileRoute("/_authenticated/infrastructure/health")({
  head: () => ({
    meta: [
      { title: "Device Health — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Unified device health dashboard with estate health scores, diagnostics Test Centre and a live infrastructure log stream.",
      },
      { property: "og:title", content: "Device Health — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Estate health scoring, diagnostics test centre and live infrastructure logs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeviceHealthPage,
});

function DeviceHealthPage() {
  const cameras = useQuery(infraCamerasQuery);
  const gateways = useQuery(edgeGatewaysQuery);
  const engines = useQuery(aiEnginesQuery);
  const streams = useQuery(audioStreamsQuery);
  const pools = useQuery(storagePoolsQuery);

  const error = cameras.error ?? gateways.error ?? engines.error ?? streams.error;
  const estate = buildEstateHealth(cameras.data ?? [], gateways.data ?? [], pools.data ?? []);
  const enginesHealthy = (engines.data ?? []).filter((e) => e.health === "healthy").length;

  return (
    <div>
      <PageHeader
        title="Device Health"
        description="A single operational view of camera, gateway and engine health with on-demand diagnostics."
      />

      {error ? (
        <ErrorState message={error.message} onRetry={() => cameras.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Activity}
              label="Estate health"
              value={`${estate.score}`}
              hint="Weighted score across all devices"
            />
            <MetricCard
              icon={Cctv}
              label="Cameras online"
              value={`${estate.camerasOnline}/${estate.camerasTotal}`}
              hint={`${estate.camerasOffline} offline`}
            />
            <MetricCard
              icon={ServerCog}
              label="Gateways online"
              value={`${estate.gatewaysOnline}/${estate.gatewaysTotal}`}
              hint="Edge inference nodes"
            />
            <MetricCard
              icon={Cpu}
              label="Engines healthy"
              value={`${estate.enginesHealthy}/${estate.enginesTotal}`}
              hint="Speech and reasoning providers"
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
            <Panel
              title="Test Centre"
              description="Run targeted probes against cameras, audio, RTSP and AI providers. Every verdict is written to the infrastructure log."
            >
              <TestCentre
                cameras={cameras.data ?? []}
                gateways={gateways.data ?? []}
                engines={engines.data ?? []}
                streams={streams.data ?? []}
              />
            </Panel>

            <Panel
              title="Health distribution"
              description="Cameras grouped by their current health state."
            >
              <ul className="space-y-3">
                {estate.distribution.map((bucket) => (
                  <li key={bucket.state}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{healthLabel(bucket.state)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {bucket.count} · {bucket.percent.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={bucket.percent} className="mt-1.5 h-1.5" />
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="mt-5">
            <Panel
              title="Live logs"
              description="Streaming events from connections, RTSP sessions, AI engines and speech services."
            >
              <LiveLogs />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
