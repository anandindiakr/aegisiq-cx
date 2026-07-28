import { motion } from "framer-motion";
import { Cctv, WifiOff } from "lucide-react";

import { StatusPill } from "@/components/common/Primitives";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import type { Camera } from "@/features/platform/queries";

const TONE: Record<string, "positive" | "warning" | "negative" | "neutral"> = {
  online: "positive",
  degraded: "warning",
  offline: "negative",
  maintenance: "neutral",
};

const RING: Record<string, string> = {
  online: "ring-success/30",
  degraded: "ring-warning/40",
  offline: "ring-destructive/40",
  maintenance: "ring-border",
};

export function CameraWall({
  cameras,
  outletName,
}: {
  cameras: Camera[];
  outletName: (id: string | null) => string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cameras.map((camera, index) => {
        const offline = camera.status === "offline";
        return (
          <motion.article
            key={camera.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.03 }}
            className={cn(
              "rounded-xl border border-border bg-surface/60 p-4 ring-1",
              RING[camera.status] ?? "ring-border",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg",
                    offline ? "bg-destructive/12 text-destructive" : "bg-primary/12 text-primary",
                  )}
                >
                  {offline ? <WifiOff className="size-4" /> : <Cctv className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{camera.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {outletName(camera.outlet_id)} · {camera.location ?? "Unmapped"}
                  </p>
                </div>
              </div>
              <span className="shrink-0">
                <StatusPill label={camera.status} tone={TONE[camera.status] ?? "neutral"} />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 text-[11px] text-muted-foreground">
              <span>Audio {camera.audio_enabled ? "enabled" : "muted"}</span>
              <span className="tabular-nums">Seen {formatRelative(camera.last_seen_at)}</span>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
