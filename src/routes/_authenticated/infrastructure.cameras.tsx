import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Cctv, Download, Plus, Search, Trash2, Wrench } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { AddCameraWizard } from "@/components/infrastructure/AddCameraWizard";
import { outletsQuery } from "@/features/platform/queries";
import {
  bulkUpdateCameras,
  infraCamerasQuery,
  softDeleteCameras,
  updateInfraCamera,
} from "@/features/infrastructure/queries";
import {
  CAMERA_BRANDS,
  CAMERA_HEALTH_STATES,
  camerasToCsv,
  downloadCsv,
  healthLabel,
  healthTone,
  scoreTone,
} from "@/features/infrastructure/pipeline";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/infrastructure/cameras")({
  head: () => ({
    meta: [
      { title: "Camera Management — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Enterprise camera inventory with brand, model, network, audio, firmware and health telemetry for thousands of edge devices.",
      },
      { property: "og:title", content: "Camera Management — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Enterprise camera fleet inventory, provisioning wizard and health telemetry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CameraManagementPage,
});

const STATUS_TONE: Record<string, "positive" | "negative" | "warning" | "info"> = {
  online: "positive",
  offline: "negative",
  degraded: "warning",
  maintenance: "info",
};

type SortKey = "name" | "health_score" | "last_seen_at" | "brand";

function CameraManagementPage() {
  const { data, isPending, error, refetch } = useQuery(infraCamerasQuery);
  const outlets = useQuery(outletsQuery);
  const queryClient = useQueryClient();

  const [term, setTerm] = useState("");
  const [brand, setBrand] = useState("all");
  const [status, setStatus] = useState("all");
  const [health, setHealth] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [selected, setSelected] = useState<string[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);

  const outletName = useMemo(() => {
    const map = new Map((outlets.data ?? []).map((o) => [o.id, o.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Unassigned") : "Unassigned");
  }, [outlets.data]);

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    const filtered = (data ?? []).filter((c) => {
      if (brand !== "all" && c.brand !== brand) return false;
      if (status !== "all" && c.status !== status) return false;
      if (health !== "all" && c.health_state !== health) return false;
      if (!q) return true;
      return [c.name, c.camera_code, c.zone, c.brand, c.model, c.ip_address, outletName(c.outlet_id)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
    return [...filtered].sort((a, b) => {
      if (sort === "health_score") return b.health_score - a.health_score;
      if (sort === "last_seen_at")
        return new Date(b.last_seen_at ?? 0).getTime() - new Date(a.last_seen_at ?? 0).getTime();
      if (sort === "brand") return (a.brand ?? "").localeCompare(b.brand ?? "");
      return a.name.localeCompare(b.name);
    });
  }, [data, term, brand, status, health, sort, outletName]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["infrastructure"] });
    queryClient.invalidateQueries({ queryKey: ["cameras"] });
  };

  const toggleAudio = useMutation({
    mutationFn: ({ id, audio }: { id: string; audio: boolean }) =>
      updateInfraCamera(id, { audio_enabled: audio }),
    onSuccess: () => {
      toast.success("Camera updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: async (action: "maintenance" | "online" | "audio_on" | "audio_off" | "delete") => {
      if (action === "delete") return softDeleteCameras(selected);
      if (action === "audio_on") return bulkUpdateCameras(selected, { audio_enabled: true });
      if (action === "audio_off") return bulkUpdateCameras(selected, { audio_enabled: false });
      return bulkUpdateCameras(selected, {
        status: action === "maintenance" ? "maintenance" : "online",
        health_state: action === "maintenance" ? "offline" : "online",
      });
    },
    onSuccess: (count) => {
      toast.success(`${count} cameras updated`);
      setSelected([]);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allSelected = rows.length > 0 && selected.length === rows.length;
  const online = (data ?? []).filter((c) => c.status === "online").length;

  return (
    <div>
      <PageHeader
        title="Camera Management"
        description="Enterprise inventory of every edge audio-capture device: network, codecs, audio policy, firmware and live health."
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                downloadCsv(
                  `aegisiq-cameras-${new Date().toISOString().slice(0, 10)}.csv`,
                  camerasToCsv(rows, outletName),
                );
                toast.success("Camera inventory exported");
              }}
            >
              <Download className="mr-2 size-4" /> Export
            </Button>
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <Plus className="mr-2 size-4" /> Register camera
            </Button>
          </>
        }
      />

      <Panel
        title={`${rows.length} cameras`}
        description={`${online} online · ${(data ?? []).length - online} require attention`}
      >
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search camera, code, zone, brand, IP or outlet"
              className="bg-surface pl-9"
              maxLength={80}
            />
          </div>
          <Filter value={brand} onChange={setBrand} placeholder="Brand" options={CAMERA_BRANDS} />
          <Filter
            value={status}
            onChange={setStatus}
            placeholder="Status"
            options={["online", "offline", "degraded", "maintenance"]}
          />
          <Filter
            value={health}
            onChange={setHealth}
            placeholder="Health"
            options={CAMERA_HEALTH_STATES.map((s) => s.id)}
          />
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-9 w-40 bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort: Name</SelectItem>
              <SelectItem value="brand">Sort: Brand</SelectItem>
              <SelectItem value="health_score">Sort: Health score</SelectItem>
              <SelectItem value="last_seen_at">Sort: Last seen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selected.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
            <span className="text-xs font-medium">{selected.length} selected</span>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate("maintenance")}>
              <Wrench className="mr-2 size-3.5" /> Maintenance
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate("online")}>
              Return to service
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate("audio_on")}>
              Audio on
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate("audio_off")}>
              Audio off
            </Button>
            <Button size="sm" variant="ghost" onClick={() => bulk.mutate("delete")}>
              <Trash2 className="mr-2 size-3.5" /> Retire
            </Button>
          </div>
        )}

        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isPending ? (
          <LoadingState rows={10} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No cameras match these filters"
            description="Clear the search or filters, or register a new device to this outlet."
            action={
              <Button size="sm" onClick={() => setWizardOpen(true)}>
                <Cctv className="mr-2 size-4" /> Register camera
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      aria-label="Select all cameras"
                      onCheckedChange={(checked) =>
                        setSelected(checked ? rows.map((r) => r.id) : [])
                      }
                    />
                  </TableHead>
                  <TableHead>Camera</TableHead>
                  <TableHead>Camera ID</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>IP address</TableHead>
                  <TableHead>RTSP URL</TableHead>
                  <TableHead>Audio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Firmware</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((camera) => (
                  <TableRow key={camera.id} className="border-border">
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(camera.id)}
                        aria-label={`Select ${camera.name}`}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked ? [...prev, camera.id] : prev.filter((id) => id !== camera.id),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{camera.name}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {camera.camera_code ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{outletName(camera.outlet_id)}</TableCell>
                    <TableCell className="text-xs">{camera.zone ?? "—"}</TableCell>
                    <TableCell className="text-xs">{camera.brand ?? "—"}</TableCell>
                    <TableCell className="text-xs">{camera.model ?? "—"}</TableCell>
                    <TableCell className="font-mono text-[11px]">
                      {camera.ip_address ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-52 truncate font-mono text-[11px] text-muted-foreground">
                      {camera.rtsp_url ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={camera.audio_enabled}
                        aria-label={`Toggle audio for ${camera.name}`}
                        onCheckedChange={(checked) =>
                          toggleAudio.mutate({ id: camera.id, audio: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={camera.status}
                        tone={STATUS_TONE[camera.status] ?? "info"}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {camera.firmware ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatRelative(camera.last_seen_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusPill
                          label={healthLabel(camera.health_state)}
                          tone={healthTone(camera.health_state)}
                        />
                        <span
                          className={cnScore(camera.health_score)}
                          title={`Health score ${camera.health_score}`}
                        >
                          {camera.health_score}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <AddCameraWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

function cnScore(score: number) {
  const tone = scoreTone(score);
  return `text-xs font-semibold tabular-nums ${
    tone === "positive" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive"
  }`;
}

function Filter({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-40 bg-surface">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}: All</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option} className="capitalize">
            {option.replace(/_/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
