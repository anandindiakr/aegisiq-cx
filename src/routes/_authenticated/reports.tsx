import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileBarChart } from "lucide-react";

import {
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { conversationsQuery, outletsQuery } from "@/features/platform/queries";
import { formatNumber, LANGUAGE_NAMES, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Board-ready customer experience reporting: outlet benchmarks, topic mix and language distribution.",
      },
      { property: "og:title", content: "Reports — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Board-ready customer experience reporting across the estate.",
      },
    ],
  }),
  component: ReportsPage,
});

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-primary-glow)",
];

const AXIS = { stroke: "var(--color-muted-foreground)", fontSize: 11 };

function ReportsPage() {
  const { data, isPending, error, refetch } = useQuery(conversationsQuery);
  const outlets = useQuery(outletsQuery);
  const rows = data ?? [];

  const byOutlet = useMemo(() => {
    return (outlets.data ?? []).map((o) => {
      const set = rows.filter((r) => r.outlet_id === o.id);
      const sentiment = set.length
        ? set.reduce((s, r) => s + Number(r.sentiment_score), 0) / set.length
        : 0;
      return {
        outlet: o.name.replace("Meridian ", ""),
        conversations: set.length,
        sentiment: Number(sentiment.toFixed(2)),
        escalations: set.filter((r) => r.escalated).length,
        avgDuration: set.length
          ? Math.round(set.reduce((s, r) => s + r.duration_seconds, 0) / set.length)
          : 0,
      };
    });
  }, [rows, outlets.data]);

  const byLanguage = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.language_code, (map.get(r.language_code) ?? 0) + 1);
    return Array.from(map.entries()).map(([code, value]) => ({
      name: LANGUAGE_NAMES[code] ?? code,
      value,
    }));
  }, [rows]);

  const byTopic = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.topic ?? "Other", (map.get(r.topic ?? "Other") ?? 0) + 1);
    return Array.from(map.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Comparative performance across outlets, topics and languages, ready for executive distribution."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-2 size-4" /> Export PDF
            </Button>
            <Button size="sm">
              <FileBarChart className="mr-2 size-4" /> Schedule report
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              title="Topic distribution"
              description="Conversation volume by detected intent"
              className="xl:col-span-2"
            >
              {isPending ? (
                <LoadingState rows={4} />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byTopic}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="topic"
                      tick={{ ...AXIS, fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-16}
                      height={60}
                      textAnchor="end"
                    />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      cursor={{ fill: "var(--color-muted)" }}
                    />
                    <Bar dataKey="count" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel title="Language mix" description="Share of conversations per language">
              {isPending ? (
                <LoadingState rows={4} />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={byLanguage}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={96}
                      paddingAngle={3}
                    >
                      {byLanguage.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          <Panel title="Outlet benchmark" description="Volume, sentiment and escalation rate by site">
            {isPending ? (
              <LoadingState rows={5} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Outlet</TableHead>
                      <TableHead className="text-right">Conversations</TableHead>
                      <TableHead className="text-right">Avg sentiment</TableHead>
                      <TableHead className="text-right">Escalations</TableHead>
                      <TableHead className="text-right">Avg handling time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byOutlet.map((row) => (
                      <TableRow key={row.outlet} className="border-border">
                        <TableCell className="text-xs font-medium">
                          {titleCase(row.outlet)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatNumber(row.conversations)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {row.sentiment.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatNumber(row.escalations)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {Math.round(row.avgDuration / 60)}m
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
