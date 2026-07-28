import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { infraEventsQuery } from "@/features/infrastructure/queries";

const SOURCES = ["all", "connection", "rtsp", "ai", "speech", "alerts", "errors", "warnings"];

const LEVEL_TONE: Record<string, string> = {
  info: "text-info",
  warn: "text-warning",
  error: "text-destructive",
};

/** Terminal-style live log stream for the infrastructure plane. */
export function LiveLogs({ limit = 150 }: { limit?: number }) {
  const [source, setSource] = useState("all");
  const { data, isPending } = useQuery({
    ...infraEventsQuery(limit),
    refetchInterval: 15_000,
  });

  const rows = useMemo(
    () => (data ?? []).filter((e) => source === "all" || e.source === source),
    [data, source],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {SOURCES.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={source === item ? "secondary" : "ghost"}
            className="h-7 px-2.5 text-[11px] capitalize"
            onClick={() => setSource(item)}
          >
            {item}
          </Button>
        ))}
      </div>

      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border bg-background/70 p-3 font-mono text-[11px] leading-relaxed">
        {isPending ? (
          <p className="text-muted-foreground">Attaching to log stream…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground">No events on this channel.</p>
        ) : (
          rows.map((event) => (
            <p key={event.id} className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">
                {new Date(event.created_at).toISOString().slice(11, 19)}
              </span>
              <span className={cn("w-12 shrink-0 uppercase", LEVEL_TONE[event.level])}>
                {event.level}
              </span>
              <span className="w-24 shrink-0 truncate text-primary/80">[{event.source}]</span>
              <span className="min-w-0 flex-1 text-foreground/90">
                {event.device_name ? `${event.device_name} · ` : ""}
                {event.message}
              </span>
            </p>
          ))
        )}
      </div>
    </div>
  );
}
