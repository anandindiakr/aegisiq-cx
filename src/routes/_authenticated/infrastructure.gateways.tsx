import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cpu, HardDrive, Plus, Search, Thermometer } from "lucide-react";

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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddGatewayDialog } from "@/components/infrastructure/AddGatewayDialog";
import { edgeGatewaysQuery, infraCamerasQuery } from "@/features/infrastructure/queries";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/infrastructure/gateways")({
  head: () => ({
    meta: [
      { title: "Edge Gateways — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Manage AI edge gateways: CPU, GPU, memory, disk and temperature telemetry with agent version and heartbeat monitoring.",
      },
      { property: "og:title", content: "Edge Gateways — AegisIQ CX™" },
      {
        property: "og:description",
        content: "AI edge device fleet with live resource telemetry and heartbeat monitoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EdgeGatewaysPage,
});

const STATUS_TONE: Record<string, "positive" | "negative" | "warning"> = {
  online: "positive",
  offline: "negative",
  degraded: "warning",
};

function EdgeGatewaysPage() {
  const { data, isPending, error, refetch } = useQuery(edgeGatewaysQuery);
  const cameras = useQuery(infraCamerasQuery);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  const attached = useMemo(() => {
    const map = new Map<string, number>();
    for (const camera of cameras.data ?? []) {
      if (!camera.gateway_id) continue;
      map.set(camera.gateway_id, (map.get(camera.gateway_id) ?? 0) + 1);
    }
    return map;
  }, [cameras.data]);

  const rows = (data ?? []).filter((g) => {
    const q = term.trim().toLowerCase();
    if (!q) return true;
    return [g.name, g.serial_number, g.ip_address, g.location, g.gpu_model]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });

  const online = (data ?? []).filter((g) => g.status === "online").length;

  return (
    <div>
      <PageHeader
        title="Edge Gateways"
        description="On-premise AI inference nodes running the ingest, diarization and transcription services for each site."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 size-4" /> Enrol gateway
          </Button>
        }
      />

      <Panel
        title={`${rows.length} gateways`}
        description={`${online} online · ${(data ?? []).length - online} need attention`}
      >
        <div className="relative mb-5 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search gateway, serial, IP or GPU"
            className="bg-surface pl-9"
            maxLength={80}
          />
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isPending ? (
          <LoadingState rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No gateways match this search"
            description="Clear the search term or enrol a new AI edge device."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Gateway</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28">CPU</TableHead>
                  <TableHead className="w-28">Memory</TableHead>
                  <TableHead className="w-28">GPU</TableHead>
                  <TableHead className="w-28">Disk</TableHead>
                  <TableHead>Temp</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Heartbeat</TableHead>
                  <TableHead>Cameras</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((gateway) => (
                  <TableRow key={gateway.id} className="border-border">
                    <TableCell>
                      <p className="font-mono text-xs">{gateway.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {gateway.gpu_model} · {gateway.ram_gb}GB
                      </p>
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-xs">
                      {gateway.location ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[11px]">
                      {gateway.ip_address ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={gateway.status}
                        tone={STATUS_TONE[gateway.status] ?? "neutral"}
                      />
                    </TableCell>
                    <TableCell>
                      <Usage value={Number(gateway.cpu_usage)} />
                    </TableCell>
                    <TableCell>
                      <Usage value={Number(gateway.memory_usage)} />
                    </TableCell>
                    <TableCell>
                      <Usage value={Number(gateway.gpu_usage)} />
                    </TableCell>
                    <TableCell>
                      <Usage value={Number(gateway.disk_usage)} />
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Thermometer className="size-3 text-muted-foreground" />
                        {Number(gateway.temperature_c).toFixed(0)}°C
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {gateway.agent_version}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatRelative(gateway.last_heartbeat_at)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {attached.get(gateway.id) ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Spec
          icon={Cpu}
          label="Inference runtime"
          value="CUDA 12 · TensorRT"
          hint="Whisper and Pyannote served from the GPU pool"
        />
        <Spec
          icon={HardDrive}
          label="Deployment"
          value="Docker Compose"
          hint="Rolling agent updates with health-gated rollback"
        />
        <Spec
          icon={Thermometer}
          label="Thermal policy"
          value="Throttle at 82°C"
          hint="Workloads shed to a peer gateway before shutdown"
        />
      </div>

      <AddGatewayDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function Usage({ value }: { value: number }) {
  return (
    <div className="space-y-1">
      <Progress value={value} className="h-1.5" />
      <span className="text-[11px] tabular-nums text-muted-foreground">{value.toFixed(0)}%</span>
    </div>
  );
}

function Spec({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="panel flex items-start gap-3 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium">{value}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
