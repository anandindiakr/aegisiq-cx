import { AnimatePresence, motion } from "framer-motion";
import { Activity, Cctv, MessagesSquare, Siren } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { EmptyState } from "@/components/common/Primitives";
import type { LiveEvent } from "@/features/live-monitor/stream";

const ICON = {
  alert: Siren,
  conversation: MessagesSquare,
  camera: Cctv,
} as const;

const SEVERITY: Record<LiveEvent["severity"], string> = {
  critical: "bg-destructive/12 text-destructive ring-destructive/30",
  warning: "bg-warning/12 text-warning ring-warning/30",
  info: "bg-info/12 text-info ring-info/30",
};

export function LiveFeed({ events }: { events: LiveEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="Waiting for live signals"
        description="New alerts, conversations and camera health changes appear here the moment they reach the platform."
      />
    );
  }

  return (
    <ul className="space-y-2">
      <AnimatePresence initial={false}>
        {events.map((event) => {
          const Icon = ICON[event.kind] ?? Activity;
          return (
            <motion.li
              key={event.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="flex items-start gap-3 rounded-lg border border-border bg-surface/50 px-3 py-2.5"
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg ring-1",
                  SEVERITY[event.severity],
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{event.title}</p>
                <p className="truncate text-xs text-muted-foreground">{event.detail}</p>
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {formatRelative(event.at)}
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
