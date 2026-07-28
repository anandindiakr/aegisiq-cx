import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Cctv,
  Circle,
  MessagesSquare,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";

import {
  ErrorState,
  LoadingState,
  MetricCard,
  MetricSkeletonGrid,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { CameraWall } from "@/components/live-monitor/CameraWall";
import { LiveFeed } from "@/components/live-monitor/LiveFeed";
import { alertsQuery, camerasQuery, companyQuery, outletsQuery } from "@/features/platform/queries";
import { liveConversationsQuery } from "@/features/live-monitor/queries";
import { useLiveMonitorStream } from "@/features/live-monitor/stream";
import { formatNumber, formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/live-monitor")({
  head: () => ({
    meta: [
      { title: "Live Monitor — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Real-time operations wall for camera health, live conversations and incoming customer experience alerts across your estate.",
      },
      { property: "og:title", content: "Live Monitor — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Watch estate health, conversations and alerts stream in live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveMonitorPage,
});

const STATUS_TONE = {
  live: "positive",
  connecting: "info",
  paused: "warning",
  error: "negative",
} as const;

function LiveMonitorPage() {
  const company = useQuery(companyQuery);
  const cameras = useQuery(camerasQuery);
  const outlets = useQuery(outletsQuery);
  const alerts = useQuery(alertsQuery);
  const conversations = useQuery(liveConversationsQuery);

  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(false);

  const { status, events, lastEventAt, clearEvents } = useLiveMonitorStream({
    companyId: company.data?.id,
    paused,
    onAlert: (row) => {
      if (!sound) return;
      const severity = String(row.severity ?? "info");
      if (severity === "critical" || severity === "high") {
        toast.error(`Critical alert — ${String(row.title ?? "")}`);
      }
    },
  });

  const outletName = useMemo(() => {
    const map = new Map((outlets.data ?? []).map((o) => [o.id, o.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Estate-wide") : "Estate-wide");
  }, [outlets.data]);

  const cameraRows = cameras.data ?? [];
  const online = cameraRows.filter((c) => c.status === "online").length;
  const offline = cameraRows.filter((c) => c.status === "offline").length;
  const degraded = cameraRows.filter((c) => c.status === "degraded").length;

  const sinceWindow = Date.now() - 60 * 60 * 1000;
  const recentConversations = (conversations.data ?? []).filter(
    (c) => new Date(c.started_at).getTime() >= sinceWindow,
  );
  const openCritical = (alerts.data ?? []).filter(
    (a) => a.status === "open" && (a.severity === "critical" || a.severity === "high"),
  ).length;

  const loading = cameras.isPending || alerts.isPending || conversations.isPending;
  const error = cameras.error ?? alerts.error ?? conversations.error;

  return (
    <div>
      <PageHeader
        title="Live Monitor"
        description="A single operations wall for estate device health, conversations in flight and alerts as they land."
        actions={
          <>
            <StatusPill
              label={status === "live" ? "streaming live" : status}
              tone={STATUS_TONE[status]}
            />
            <Button variant="outline" size="sm" onClick={() => setSound((s) => !s)}>
              {sound ? <Volume2 className="mr-2 size-4" /> : <VolumeX className="mr-2 size-4" />}
              {sound ? "Alerts on" : "Alerts muted"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)}>
              {paused ? <Play className="mr-2 size-4" /> : <Pause className="mr-2 size-4" />}
              {paused ? "Resume stream" : "Pause stream"}
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorState
          message={error.message}
          onRetry={() => {
            void cameras.refetch();
            void alerts.refetch();
            void conversations.refetch();
          }}
        />
      ) : loading ? (
        <MetricSkeletonGrid count={4} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Cameras online"
              value={`${formatNumber(online)}/${formatNumber(cameraRows.length)}`}
              hint={`${formatNumber(degraded)} degraded`}
              icon={Cctv}
              index={0}
            />
            <MetricCard
              label="Devices offline"
              value={formatNumber(offline)}
              hint="Requires field response"
              icon={AlertTriangle}
              index={1}
            />
            <MetricCard
              label="Conversations (1h)"
              value={formatNumber(recentConversations.length)}
              hint={`${formatNumber(recentConversations.filter((c) => c.escalated).length)} escalated`}
              icon={MessagesSquare}
              index={2}
            />
            <MetricCard
              label="Open critical alerts"
              value={formatNumber(openCritical)}
              hint={lastEventAt ? `Last signal ${formatRelative(lastEventAt)}` : "No signals yet"}
              icon={Activity}
              index={3}
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
            <Panel
              title="Camera wall"
              description={`${formatNumber(cameraRows.length)} devices · health updates stream in real time`}
            >
              {cameraRows.length === 0 ? (
                <LoadingState rows={3} />
              ) : (
                <CameraWall cameras={cameraRows} outletName={outletName} />
              )}
            </Panel>

            <Panel
              title="Live signal feed"
              description="Alerts, conversations and device changes as they arrive"
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearEvents}
                  disabled={events.length === 0}
                >
                  <RotateCcw className="mr-2 size-4" /> Clear
                </Button>
              }
            >
              <div className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Circle
                  className={
                    status === "live"
                      ? "size-2 fill-success text-success"
                      : "size-2 fill-muted-foreground text-muted-foreground"
                  }
                />
                {status === "paused"
                  ? "Stream paused — no events are being captured"
                  : status === "error"
                    ? "Connection interrupted — retrying"
                    : `${formatNumber(events.length)} events this session`}
              </div>
              <LiveFeed events={events} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
