import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AudioLines } from "lucide-react";

import {
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { audioStreamsQuery, infraCamerasQuery } from "@/features/infrastructure/queries";

export const Route = createFileRoute("/_authenticated/infrastructure/audio")({
  head: () => ({
    meta: [
      { title: "Audio Streams — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Live audio stream monitoring: sampling rate, codec, latency, packet loss, noise floor and signal quality for every capture device.",
      },
      { property: "og:title", content: "Audio Streams — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Monitor audio capture quality, latency and packet loss across the estate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AudioStreamsPage,
});

function AudioStreamsPage() {
  const { data, isPending, error, refetch } = useQuery(audioStreamsQuery);
  const cameras = useQuery(infraCamerasQuery);

  const cameraName = useMemo(() => {
    const map = new Map((cameras.data ?? []).map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? "Unknown device";
  }, [cameras.data]);

  const rows = data ?? [];
  const active = rows.filter((s) => s.status === "streaming").length;
  const avgLatency = rows.length
    ? Math.round(rows.reduce((sum, s) => sum + s.latency_ms, 0) / rows.length)
    : 0;
  const avgLoss = rows.length
    ? rows.reduce((sum, s) => sum + Number(s.packet_loss), 0) / rows.length
    : 0;
  const avgQuality = rows.length
    ? Math.round(rows.reduce((sum, s) => sum + Number(s.signal_quality), 0) / rows.length)
    : 0;

  return (
    <div>
      <PageHeader
        title="Audio Streams"
        description="Real-time capture telemetry from every microphone feeding the speech pipeline."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={AudioLines}
          label="Active streams"
          value={`${active}`}
          hint={`${rows.length} configured`}
        />
        <MetricCard
          icon={Timer}
          label="Average latency"
          value={`${avgLatency}ms`}
          hint="Capture to ingest"
        />
        <MetricCard
          icon={Waves}
          label="Packet loss"
          value={`${avgLoss.toFixed(2)}%`}
          hint="Estate-wide average"
        />
        <MetricCard
          icon={SignalHigh}
          label="Signal quality"
          value={`${avgQuality}`}
          hint="0–100 composite score"
        />
      </div>

      <Panel title="Stream telemetry" description="Sampled every 30 seconds from the edge agents.">
        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isPending ? (
          <LoadingState rows={8} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Device</TableHead>
                  <TableHead>Codec</TableHead>
                  <TableHead>Sampling</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Bitrate</TableHead>
                  <TableHead>Noise floor</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Packet loss</TableHead>
                  <TableHead className="w-36">Signal quality</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((stream) => (
                  <TableRow key={stream.id} className="border-border">
                    <TableCell className="font-mono text-xs">
                      <span className="inline-flex items-center gap-2">
                        <AudioLines className="size-3.5 text-primary" />
                        {cameraName(stream.camera_id)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{stream.codec}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {(stream.sampling_rate / 1000).toFixed(1)} kHz
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{stream.channels}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {stream.bitrate_kbps} kbps
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {Number(stream.noise_floor_db).toFixed(1)} dB
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{stream.latency_ms} ms</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {Number(stream.packet_loss).toFixed(2)}%
                    </TableCell>
                    <TableCell>
                      <Progress value={Number(stream.signal_quality)} className="h-1.5" />
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {Number(stream.signal_quality).toFixed(0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={stream.status}
                        tone={
                          stream.status === "streaming"
                            ? "positive"
                            : stream.status === "degraded"
                              ? "warning"
                              : "negative"
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
