/**
 * Reusable chart primitives for the Executive Command Centre.
 *
 * Every chart in the module renders through these wrappers so axis styling,
 * tooltips, palette and responsive behaviour stay identical across widgets.
 */
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export const SENTIMENT_COLORS: Record<string, string> = {
  very_positive: "var(--color-success)",
  positive: "var(--color-chart-3)",
  neutral: "var(--color-chart-2)",
  negative: "var(--color-warning)",
  very_negative: "var(--color-destructive)",
};

const AXIS = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export function tooltipStyle() {
  return {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--color-popover-foreground)",
    boxShadow: "var(--shadow-raised)",
  };
}

export function ChartFrame({ height = 240, children }: { height?: number; children: ReactNode }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children as never}
      </ResponsiveContainer>
    </div>
  );
}

export interface SeriesPoint {
  label: string;
  value: number;
  secondary?: number;
}

export function TrendAreaChart({
  data,
  height = 240,
  valueName = "Conversations",
  secondaryName,
}: {
  data: SeriesPoint[];
  height?: number;
  valueName?: string;
  secondaryName?: string;
}) {
  return (
    <ChartFrame height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="cc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={44} />
        <Tooltip contentStyle={tooltipStyle()} cursor={{ stroke: "var(--color-border)" }} />
        <Area
          type="monotone"
          dataKey="value"
          name={valueName}
          stroke="var(--color-primary)"
          strokeWidth={2}
          fill="url(#cc-area)"
        />
        {secondaryName && (
          <Area
            type="monotone"
            dataKey="secondary"
            name={secondaryName}
            stroke="var(--color-chart-2)"
            strokeWidth={2}
            fill="transparent"
          />
        )}
      </AreaChart>
    </ChartFrame>
  );
}

export function CategoryBarChart({
  data,
  height = 240,
  colors,
  valueName = "Conversations",
}: {
  data: SeriesPoint[];
  height?: number;
  colors?: string[];
  valueName?: string;
}) {
  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={44} />
        <Tooltip
          contentStyle={tooltipStyle()}
          cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
        />
        <Bar dataKey="value" name={valueName} radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={entry.label}
              fill={
                colors?.[index % (colors.length || 1)] ?? CHART_COLORS[index % CHART_COLORS.length]
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

export function DonutChart({
  data,
  height = 260,
  onSelect,
}: {
  data: SeriesPoint[];
  height?: number;
  onSelect?: (label: string) => void;
}) {
  return (
    <ChartFrame height={height}>
      <PieChart>
        <Tooltip contentStyle={tooltipStyle()} />
        <Legend
          verticalAlign="bottom"
          height={28}
          formatter={(value: string) => (
            <span className="text-xs text-muted-foreground">{value}</span>
          )}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="58%"
          outerRadius="86%"
          paddingAngle={2}
          stroke="var(--color-background)"
          strokeWidth={2}
          onClick={(entry: unknown) => {
            const point = entry as { label?: string };
            if (point.label && onSelect) onSelect(point.label);
          }}
        >
          {data.map((entry, index) => (
            <Cell
              key={entry.label}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
              className={onSelect ? "cursor-pointer" : undefined}
            />
          ))}
        </Pie>
      </PieChart>
    </ChartFrame>
  );
}

export function GaugeChart({ value, height = 220 }: { value: number; height?: number }) {
  const data = [{ name: "score", value, fill: "var(--color-primary)" }];
  return (
    <ChartFrame height={height}>
      <RadialBarChart
        data={data}
        innerRadius="72%"
        outerRadius="100%"
        startAngle={220}
        endAngle={-40}
        barSize={16}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: "var(--color-muted)" }} dataKey="value" cornerRadius={12} />
      </RadialBarChart>
    </ChartFrame>
  );
}
