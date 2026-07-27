import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { camerasQuery, outletsQuery, updateCamera } from "@/features/platform/queries";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cameras")({
  head: () => ({
    meta: [
      { title: "Cameras — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Camera fleet inventory with stream endpoints, audio capture state, health status and last-seen telemetry.",
      },
      { property: "og:title", content: "Cameras — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Camera fleet inventory, audio capture state and device health.",
      },
    ],
  }),
  component: CamerasPage,
});

const STATUS_TONE: Record<string, "positive" | "negative" | "warning" | "info"> = {
  online: "positive",
  offline: "negative",
  degraded: "warning",
  maintenance: "info",
};

function CamerasPage() {
  const { data, isPending, error, refetch } = useQuery(camerasQuery);
  const outlets = useQuery(outletsQuery);
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");

  const outletName = useMemo(() => {
    const map = new Map((outlets.data ?? []).map((o) => [o.id, o.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Unassigned") : "Unassigned");
  }, [outlets.data]);

  const toggleAudio = useMutation({
    mutationFn: ({ id, audio }: { id: string; audio: boolean }) =>
      updateCamera(id, { audio_enabled: audio }),
    onSuccess: () => {
      toast.success("Camera updated");
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data ?? []).filter((c) => {
    const q = term.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.location ?? "").toLowerCase().includes(q) ||
      outletName(c.outlet_id).toLowerCase().includes(q)
    );
  });

  const online = (data ?? []).filter((c) => c.status === "online").length;

  return (
    <div>
      <PageHeader
        title="Cameras"
        description="Edge audio-capture devices registered to this tenant. Stream connectivity is provisioned separately."
        actions={
          <Button size="sm">
            <Plus className="mr-2 size-4" /> Register camera
          </Button>
        }
      />

      <Panel
        title={`${rows.length} cameras`}
        description={`${online} online · ${(data ?? []).length - online} require attention`}
      >
        <div className="relative mb-5 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search camera, location or outlet"
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
            title="No cameras match this search"
            description="Clear the search term or register a new device to this outlet."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Camera</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Stream endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Audio</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((camera) => (
                  <TableRow key={camera.id} className="border-border">
                    <TableCell className="font-mono text-xs">{camera.name}</TableCell>
                    <TableCell className="text-xs">{outletName(camera.outlet_id)}</TableCell>
                    <TableCell className="text-xs">{camera.location}</TableCell>
                    <TableCell className="max-w-56 truncate font-mono text-[11px] text-muted-foreground">
                      {camera.rtsp_url}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={camera.status}
                        tone={STATUS_TONE[camera.status] ?? "info"}
                      />
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
                    <TableCell className="text-xs text-muted-foreground">
                      {formatRelative(camera.last_seen_at)}
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
