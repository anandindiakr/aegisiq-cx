import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Cpu,
  Download,
  HardDrive,
  KeyRound,
  Loader2,
  Plus,
  PowerOff,
  Search,
  Thermometer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddGatewayDialog } from "@/components/infrastructure/AddGatewayDialog";
import { DeviceCredentialsDialog } from "@/components/infrastructure/DeviceCredentialsDialog";
import { InfraChangeHistory } from "@/components/infrastructure/InfraChangeHistory";
import { useCredentialAccess } from "@/features/infrastructure/audit";
import { useInfraAccess } from "@/features/infrastructure/access";
import {
  bulkUpdateGateways,
  edgeGatewaysQuery,
  infraCamerasQuery,
  softDeleteGateways,
  type EdgeGateway,
} from "@/features/infrastructure/queries";
import { downloadCsv, gatewaysToCsv } from "@/features/infrastructure/pipeline";
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
  const credentialAccess = useCredentialAccess();
  const access = useInfraAccess();
  const queryClient = useQueryClient();
  const [credentialFor, setCredentialFor] = useState<{ id: string; name: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmRetire, setConfirmRetire] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["infrastructure", "gateways"] });

  const bulkServices = useMutation({
    mutationFn: ({ patch }: { patch: Partial<EdgeGateway>; label: string }) =>
      bulkUpdateGateways(selected, patch),
    onSuccess: (count, variables) => {
      toast.success(`${variables.label} for ${count} gateway${count === 1 ? "" : "s"}`, {
        description: "Each change is recorded in the gateway change history.",
      });
      setSelected([]);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["infrastructure", "audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retire = useMutation({
    mutationFn: () => softDeleteGateways(selected),
    onSuccess: (count) => {
      toast.success(`${count} gateway${count === 1 ? "" : "s"} decommissioned`, {
        description: "Retired nodes stay in the change history for audit.",
      });
      setSelected([]);
      setConfirmRetire(false);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["infrastructure", "audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
  const selectedRows = (data ?? []).filter((g) => selected.includes(g.id));
  const allVisibleSelected = rows.length > 0 && rows.every((g) => selected.includes(g.id));
  const busy = bulkServices.isPending || retire.isPending;

  const toggleRow = (id: string, checked: boolean) =>
    setSelected((current) =>
      checked ? [...new Set([...current, id])] : current.filter((value) => value !== id),
    );

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

        {selected.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
            <span className="text-xs font-medium">
              {selected.length} gateway{selected.length === 1 ? "" : "s"} selected
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !access.can("operate")}
                onClick={() =>
                  bulkServices.mutate({
                    patch: { ingest_enabled: true, transcription_enabled: true },
                    label: "Ingest and transcription enabled",
                  })
                }
              >
                {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
                Enable services
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !access.can("operate")}
                onClick={() =>
                  bulkServices.mutate({
                    patch: {
                      ingest_enabled: false,
                      transcription_enabled: false,
                      diarization_enabled: false,
                    },
                    label: "All services disabled",
                  })
                }
              >
                <PowerOff className="mr-2 size-3.5" /> Disable services
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !access.can("operate")}
                onClick={() =>
                  bulkServices.mutate({
                    patch: { diarization_enabled: true },
                    label: "Diarization enabled",
                  })
                }
              >
                Enable diarization
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  downloadCsv(
                    `aegisiq-gateways-${new Date().toISOString().slice(0, 10)}.csv`,
                    gatewaysToCsv(selectedRows),
                  );
                  toast.success(`Exported ${selectedRows.length} gateways`);
                }}
              >
                <Download className="mr-2 size-3.5" /> Export selection
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy || !access.can("decommission")}
                onClick={() => setConfirmRetire(true)}
              >
                <Trash2 className="mr-2 size-3.5" /> Decommission
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
          </div>
        )}

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
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      aria-label="Select all gateways"
                      onCheckedChange={(checked) =>
                        setSelected(checked ? rows.map((g) => g.id) : [])
                      }
                    />
                  </TableHead>
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
                  <TableHead>Services</TableHead>
                  <TableHead>Cameras</TableHead>
                  <TableHead className="w-32">Credentials</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((gateway) => (
                  <TableRow key={gateway.id} className="border-border">
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(gateway.id)}
                        aria-label={`Select ${gateway.name}`}
                        onCheckedChange={(checked) => toggleRow(gateway.id, checked === true)}
                      />
                    </TableCell>
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
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusPill
                          label="ingest"
                          tone={gateway.ingest_enabled ? "positive" : "neutral"}
                        />
                        <StatusPill
                          label="stt"
                          tone={gateway.transcription_enabled ? "positive" : "neutral"}
                        />
                        <StatusPill
                          label="diarize"
                          tone={gateway.diarization_enabled ? "positive" : "neutral"}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {attached.get(gateway.id) ?? 0}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!credentialAccess.canView}
                        onClick={() => setCredentialFor({ id: gateway.id, name: gateway.name })}
                      >
                        <KeyRound className="mr-2 size-3.5" /> Manage
                      </Button>
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

      <div className="mt-5">
        <InfraChangeHistory
          scope={["gateway", "gateway_credential"]}
          title="Gateway change history"
          description="Enrolment, configuration edits, decommissions and credential access for every edge node."
        />
      </div>

      <AlertDialog open={confirmRetire} onOpenChange={setConfirmRetire}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Decommission {selected.length} gateway{selected.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The nodes stop accepting audio and drop out of the fleet views. History and audit
              records are kept, and the action is attributed to you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                retire.mutate();
              }}
            >
              Decommission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddGatewayDialog open={open} onOpenChange={setOpen} />
      <DeviceCredentialsDialog
        open={credentialFor !== null}
        onOpenChange={(value) => !value && setCredentialFor(null)}
        deviceType="gateway"
        deviceId={credentialFor?.id ?? null}
        deviceName={credentialFor?.name ?? ""}
      />
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
