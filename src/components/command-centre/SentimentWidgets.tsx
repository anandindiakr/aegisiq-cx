import { useMemo } from "react";

import { Panel } from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import {
  CategoryBarChart,
  GaugeChart,
  SENTIMENT_COLORS,
  TrendAreaChart,
  tooltipStyle,
} from "./charts";
import { cxBand, cxScore } from "@/features/command-centre/insights";
import type { ExecutiveOverview } from "@/features/command-centre/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SENTIMENT_KEYS = [
  { key: "very_positive", label: "Very positive" },
  { key: "positive", label: "Positive" },
  { key: "neutral", label: "Neutral" },
  { key: "negative", label: "Negative" },
  { key: "very_negative", label: "Very negative" },
] as const;

export function SentimentOverview({ overview }: { overview: ExecutiveOverview }) {
  const stacked = overview.sentimentPeriods.map((p) => ({
    label: p.label,
    ...SENTIMENT_KEYS.reduce<Record<string, number>>((acc, k) => {
      acc[k.key] = p[k.key];
      return acc;
    }, {}),
  }));

  const daily = overview.daily.map((d) => ({
    label: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(
      new Date(d.day),
    ),
    value: d.conversations,
    secondary: d.negatives,
  }));

  const hourly = overview.hourly.map((h) => ({
    label: `${String(h.hour).padStart(2, "0")}h`,
    value: h.conversations,
  }));

  return (
    <Panel
      title="Sentiment Overview"
      description="Distribution by period, daily trend and hourly volume"
    >
      <Tabs defaultValue="distribution">
        <TabsList className="mb-4">
          <TabsTrigger value="distribution" className="text-xs">
            Distribution
          </TabsTrigger>
          <TabsTrigger value="trend" className="text-xs">
            Daily trend
          </TabsTrigger>
          <TabsTrigger value="hourly" className="text-xs">
            Hourly volume
          </TabsTrigger>
        </TabsList>

        <TabsContent value="distribution">
          <div style={{ height: 280 }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stacked} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  cursor={{ fill: "var(--color-muted)", opacity: 0.35 }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-[11px] text-muted-foreground">{value}</span>
                  )}
                />
                {SENTIMENT_KEYS.map((k, i) => (
                  <Bar
                    key={k.key}
                    dataKey={k.key}
                    name={k.label}
                    stackId="s"
                    fill={SENTIMENT_COLORS[k.key]}
                    radius={i === SENTIMENT_KEYS.length - 1 ? [6, 6, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="trend">
          <TrendAreaChart data={daily} height={280} secondaryName="Negative" />
        </TabsContent>

        <TabsContent value="hourly">
          <CategoryBarChart data={hourly} height={280} />
        </TabsContent>
      </Tabs>
    </Panel>
  );
}

export function CxScoreGauge({ overview }: { overview: ExecutiveOverview }) {
  const score = cxScore(overview);
  const band = cxBand(score);
  const k = overview.kpis;

  return (
    <Panel title="Customer Experience Score" description="Composite health index (0–100)">
      <div className="relative">
        <GaugeChart value={score} height={210} />
        <div className="pointer-events-none absolute inset-x-0 top-[46%] flex -translate-y-1/2 flex-col items-center">
          <span className="text-4xl font-semibold tabular-nums tracking-tight">{score}</span>
          <span
            className={cn(
              "mt-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              band.tone === "positive" && "border-success/40 bg-success/10 text-success",
              band.tone === "neutral" && "border-info/40 bg-info/10 text-info",
              band.tone === "warning" && "border-warning/40 bg-warning/10 text-warning",
              band.tone === "negative" &&
                "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            {band.label}
          </span>
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
        {[
          {
            label: "Positive",
            value: `${((k.positive / Math.max(1, k.total)) * 100).toFixed(0)}%`,
          },
          { label: "Sentiment", value: k.avg_sentiment.toFixed(2) },
          {
            label: "Escalation",
            value: `${((k.escalations / Math.max(1, k.total)) * 100).toFixed(1)}%`,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border/70 bg-surface/40 p-2.5">
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {item.label}
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export function RegionalComparison({ overview }: { overview: ExecutiveOverview }) {
  const rows = useMemo(
    () => [...overview.regions].sort((a, b) => b.avg_sentiment - a.avg_sentiment),
    [overview.regions],
  );
  const best = rows[0]?.region;

  return (
    <Panel title="Regional Comparison" description="Volume, sentiment and escalations by region">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs">Region</TableHead>
            <TableHead className="text-right text-xs">Conversations</TableHead>
            <TableHead className="text-right text-xs">Positive</TableHead>
            <TableHead className="text-right text-xs">Negative</TableHead>
            <TableHead className="text-right text-xs">Avg sentiment</TableHead>
            <TableHead className="text-right text-xs">Avg duration</TableHead>
            <TableHead className="text-right text-xs">Escalations</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.region}>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  {row.region}
                  {row.region === best && (
                    <Badge variant="outline" className="border-success/40 text-[10px] text-success">
                      Top
                    </Badge>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(row.conversations)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-success">
                {formatNumber(row.positives)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-destructive">
                {formatNumber(row.negatives)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.avg_sentiment.toFixed(2)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {Math.floor(row.avg_duration / 60)}m {Math.round(row.avg_duration % 60)}s
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.escalations}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                No regional activity for the selected filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Panel>
  );
}
