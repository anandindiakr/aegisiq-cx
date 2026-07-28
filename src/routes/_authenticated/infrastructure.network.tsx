import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gauge, Network, Radio, Waves } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ErrorState, MetricCard, PageHeader, Panel } from "@/components/common/Primitives";
import {
  aiEnginesQuery,
  audioStreamsQuery,
  infraCamerasQuery,
} from "@/features/infrastructure/queries";
import { buildNetworkHealth } from "@/features/infrastructure/pipeline";

export const Route = createFileRoute("/_authenticated/infrastructure/network")({
  head: () => ({
    meta: [
      { title: "Network Health — AegisIQ CX™" },
      {
        name: "description",
        content:
          "RTSP, audio and API connection health with latency, packet loss and bandwidth utilisation across the AegisIQ edge estate.",
      },
      { property: "og:title", content: "Network Health — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Latency, packet loss and bandwidth telemetry for the edge estate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NetworkHealthPage,
});

function NetworkHealthPage() {
  const cameras = useQuery(infraCamerasQuery);
  const streams = useQuery(audioStreamsQuery);
  const engines = useQuery(aiEnginesQuery);
  const error = cameras.error ?? streams.error ?? engines.error;

  const network = buildNetworkHealth(cameras.data ?? [], streams.data ?? [], engines.data ?? []);

  const latencyBuckets = [
    { band: "<100ms", count: 0 },
    { band: "100–200ms", count: 0 },
    { band: "200–400ms", count: 0 },
    { band: "400ms+", count: 0 },
  ];
  for (const stream of streams.data ?? []) {
    const value = Number(stream.latency_ms);
    const index = value < 100 ? 0 : value < 200 ? 1 : value < 400 ? 2 : 3;
    latencyBuckets[index].count += 1;
  }

  return (
    <div>
      <PageHeader
        title="Network Health"
        description="Connection quality between cameras, edge gateways and the AegisIQ intelligence plane."
      />

      {error ? (
        <ErrorState message={error.message} onRetry={() => cameras.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Gauge}
              label="Average latency"
              value={`${network.avgLatency}ms`}
              hint={`Peak ${network.peakLatency}ms`}
            />
            <MetricCard
              icon={Waves}
              label="Packet loss"
              value={`${network.packetLoss}%`}
              hint="Across active audio streams"
            />
            <MetricCard
              icon={Network}
              label="Bandwidth"
              value={`${network.bandwidthMbps} Mbps`}
              hint="Aggregate ingest from live cameras"
            />
            <MetricCard
              icon={Radio}
              label="Signal quality"
              value={`${network.signalQuality}`}
              hint="0–100 composite score"
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
            <Panel
              title="Latency distribution"
              description="How many audio streams sit inside each latency band."
            >
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={latencyBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="band"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.25 }}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              title="Connection inventory"
              description="Active transports between the estate and the platform."
            >
              <ul className="space-y-3 text-sm">
                <Row label="RTSP sessions" value={network.rtspConnections} hint="Camera video/audio" />
                <Row
                  label="Audio pipelines"
                  value={network.audioConnections}
                  hint="Streaming to speech engines"
                />
                <Row
                  label="AI API connections"
                  value={network.apiConnections}
                  hint="Enabled providers with credentials"
                />
                <Row
                  label="Cameras enrolled"
                  value={(cameras.data ?? []).length}
                  hint="Total registered devices"
                />
              </ul>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <span className="shrink-0 text-lg font-semibold tabular-nums">{value}</span>
    </li>
  );
}
