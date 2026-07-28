import { Activity, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { RealtimeStatus } from "@/features/command-centre/realtime";

const PHASE_LABEL: Record<RealtimeStatus["phase"], string> = {
  idle: "Idle",
  connecting: "Connecting",
  live: "Live",
  retrying: "Reconnecting",
  offline: "Offline",
};

const PHASE_TONE: Record<RealtimeStatus["phase"], string> = {
  idle: "text-muted-foreground",
  connecting: "text-amber-400",
  live: "text-emerald-400",
  retrying: "text-amber-400",
  offline: "text-destructive",
};

const PHASE_DOT: Record<RealtimeStatus["phase"], string> = {
  idle: "bg-muted-foreground",
  connecting: "bg-amber-400 animate-pulse",
  live: "bg-emerald-400",
  retrying: "bg-amber-400 animate-pulse",
  offline: "bg-destructive",
};

function time(value: string | null): string {
  return value ? new Date(value).toLocaleTimeString("en-GB") : "—";
}

/** Detailed connection panel for the Command Centre live data feed. */
export function LiveStatusPanel({ status }: { status: RealtimeStatus }) {
  const rows: [string, string][] = [
    ["Connection", PHASE_LABEL[status.phase]],
    ["Connected since", time(status.connectedAt)],
    ["Last change received", time(status.lastEventAt)],
    ["Changes received", String(status.events)],
    ["Connection attempts", String(status.attempts)],
    ["Reconnects", String(status.reconnects)],
    ["Next retry", time(status.nextRetryAt)],
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5 text-[11px]", PHASE_TONE[status.phase])}
        >
          <span className={cn("size-1.5 rounded-full", PHASE_DOT[status.phase])} />
          {PHASE_LABEL[status.phase]}
          {status.events > 0 && ` · ${status.events}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex items-center gap-2">
          <Activity className={cn("size-4", PHASE_TONE[status.phase])} />
          <p className="text-sm font-medium">Live data feed</p>
          <Badge variant="outline" className={cn("ml-auto text-[10px]", PHASE_TONE[status.phase])}>
            {PHASE_LABEL[status.phase]}
          </Badge>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Conversations, alerts and sentiment changes stream into the dashboard and refresh the
          widgets automatically.
        </p>

        <dl className="mt-3 space-y-1.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 text-[11px]">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {status.lastError && (
          <p className="mt-2 rounded-md bg-destructive/10 p-2 text-[11px] text-destructive">
            {status.lastError}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full gap-2 text-xs"
          onClick={status.reconnect}
        >
          <RefreshCw className="size-3.5" />
          Reconnect now
        </Button>
      </PopoverContent>
    </Popover>
  );
}
