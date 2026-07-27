import { useMemo, useState } from "react";
import { MapPin, TrendingDown, TrendingUp } from "lucide-react";

import { Panel } from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { outletHealth, type OutletPerformance } from "@/features/command-centre/types";

const HEALTH_CLASS = {
  healthy: "bg-success",
  attention: "bg-warning",
  critical: "bg-destructive",
} as const;

const HEALTH_BADGE = {
  healthy: "border-success/40 bg-success/10 text-success",
  attention: "border-warning/40 bg-warning/10 text-warning",
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
} as const;

type SortKey = "overall_score" | "conversations" | "avg_sentiment" | "complaint_rate";

export function OutletPerformanceTable({
  outlets,
  onSelect,
}: {
  outlets: OutletPerformance[];
  onSelect: (outlet: OutletPerformance) => void;
}) {
  const [sort, setSort] = useState<SortKey>("overall_score");
  const [desc, setDesc] = useState(true);

  const rows = useMemo(() => {
    const copy = [...outlets];
    copy.sort((a, b) => (desc ? b[sort] - a[sort] : a[sort] - b[sort]));
    return copy;
  }, [outlets, sort, desc]);

  const header = (key: SortKey, label: string) => (
    <TableHead className="text-right text-xs">
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          sort === key && "text-foreground",
        )}
        onClick={() => {
          if (sort === key) setDesc((d) => !d);
          else {
            setSort(key);
            setDesc(true);
          }
        }}
      >
        {label}
        {sort === key && (desc ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />)}
      </button>
    </TableHead>
  );

  return (
    <Panel
      title="Outlet Performance Ranking"
      description="Ranked by composite performance score across the selected window"
    >
      <div className="max-h-[420px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Outlet</TableHead>
              <TableHead className="text-xs">Region</TableHead>
              {header("conversations", "Conversations")}
              {header("avg_sentiment", "Sentiment")}
              {header("complaint_rate", "Complaint %")}
              <TableHead className="text-right text-xs">Escalations</TableHead>
              {header("overall_score", "Score")}
              <TableHead className="text-xs">Health</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((outlet) => {
              const health = outletHealth(outlet);
              return (
                <TableRow
                  key={outlet.id}
                  className="cursor-pointer"
                  onClick={() => onSelect(outlet)}
                >
                  <TableCell className="font-medium">
                    <span className="block truncate">{outlet.name}</span>
                    <span className="text-[11px] text-muted-foreground">{outlet.code}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {outlet.region ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(outlet.conversations)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {outlet.avg_sentiment.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {outlet.complaint_rate.toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{outlet.escalations}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn("block h-full rounded-full", HEALTH_CLASS[health])}
                          style={{ width: `${Math.min(100, outlet.overall_score)}%` }}
                        />
                      </span>
                      <span className="tabular-nums">{outlet.overall_score.toFixed(0)}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px]", HEALTH_BADGE[health])}>
                      {health}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No outlet activity for the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

/**
 * Geographic distribution.
 *
 * Renders outlets on an equirectangular projection so the estate footprint is
 * visible without shipping a tile-server dependency; the same coordinates feed
 * the interactive GIS layer when mapping is enabled.
 */
export function OutletMap({
  outlets,
  onSelect,
}: {
  outlets: OutletPerformance[];
  onSelect: (outlet: OutletPerformance) => void;
}) {
  const points = outlets.filter((o) => o.latitude !== null && o.longitude !== null);
  const max = Math.max(1, ...points.map((p) => p.conversations));

  return (
    <Panel
      title="Outlet Map"
      description="Geographic footprint sized by volume and coloured by health"
      actions={
        <Badge variant="outline" className="gap-1.5 text-[11px] text-muted-foreground">
          <MapPin className="size-3" />
          {points.length} located
        </Badge>
      }
    >
      <div className="relative aspect-[2/1] w-full overflow-hidden rounded-lg border border-border/70 bg-surface/40">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
            backgroundSize: "8.333% 16.666%",
          }}
        />
        <span className="absolute left-1/2 top-0 h-full w-px bg-border/70" />
        <span className="absolute left-0 top-1/2 h-px w-full bg-border/70" />
        {points.map((outlet) => {
          const health = outletHealth(outlet);
          const x = ((outlet.longitude! + 180) / 360) * 100;
          const y = ((90 - outlet.latitude!) / 180) * 100;
          const size = 10 + (outlet.conversations / max) * 18;
          return (
            <Tooltip key={outlet.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(outlet)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background/70 transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-ring"
                  style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
                  aria-label={`${outlet.name}, ${outlet.conversations} conversations`}
                >
                  <span
                    className={cn(
                      "block size-full animate-pulse rounded-full opacity-90",
                      HEALTH_CLASS[health],
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{outlet.name}</p>
                <p className="text-muted-foreground">
                  {formatNumber(outlet.conversations)} conversations · sentiment{" "}
                  {outlet.avg_sentiment.toFixed(2)}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {points.length === 0 && (
          <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            No geocoded outlets in this selection.
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        {(["healthy", "attention", "critical"] as const).map((h) => (
          <span key={h} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", HEALTH_CLASS[h])} />
            {h[0].toUpperCase() + h.slice(1)}
          </span>
        ))}
        <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-[11px]">
          Bubble size = conversation volume
        </Button>
      </div>
    </Panel>
  );
}
