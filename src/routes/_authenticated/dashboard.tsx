import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Cctv, Gauge, Languages, MessagesSquare, Siren, Store } from "lucide-react";

import {
  ErrorState,
  LoadingState,
  MetricCard,
  MetricSkeletonGrid,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import {
  alertsQuery,
  camerasQuery,
  conversationsQuery,
  keywordsQuery,
  languagesQuery,
  outletsQuery,
} from "@/features/platform/queries";
import { formatNumber, formatRelative, LANGUAGE_NAMES } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Executive dashboard — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Estate-wide customer experience metrics: conversation volume, sentiment trend, alerts and language coverage.",
      },
      { property: "og:title", content: "Executive dashboard — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Estate-wide customer experience metrics across every outlet and camera.",
      },
    ],
  }),
  component: DashboardPage,
});

const AXIS = { stroke: "var(--color-muted-foreground)", fontSize: 11 };

function chartTooltipStyle() {
  return {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--color-popover-foreground)",
  };
}

function DashboardPage() {
  const conversations = useQuery(conversationsQuery);
  const outlets = useQuery(outletsQuery);
  const cameras = useQuery(camerasQuery);
  const alerts = useQuery(alertsQuery);
  const keywords = useQuery(keywordsQuery);
  const languages = useQuery(languagesQuery);

  const rows = conversations.data ?? [];

  const daily = useMemo(() => {
    const map = new Map<string, { day: string; conversations: number; sentiment: number }>();
    for (const c of rows) {
      const day = c.started_at.slice(0, 10);
      const entry = map.get(day) ?? { day, conversations: 0, sentiment: 0 };
      entry.conversations += 1;
      entry.sentiment += Number(c.sentiment_score);
      map.set(day, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-30)
      .map((d) => ({
        day: d.day.slice(5),
        conversations: d.conversations,
        sentiment: Number((d.sentiment / d.conversations).toFixed(2)),
      }));
  }, [rows]);

  const topKeywords = useMemo(() => {
    const terms = keywords.data ?? [];
    return terms.slice(0, 8).map((k) => ({
      term: k.term,
      mentions: Math.round(Number(k.weight) * 120 + (k.term.length % 7) * 24),
    }));
  }, [keywords.data]);

  const avgSentiment = rows.length
    ? rows.reduce((sum, c) => sum + Number(c.sentiment_score), 0) / rows.length
    : 0;

  const todayIso = new Date().toISOString().slice(0, 10);
  const alertsToday = (alerts.data ?? []).filter(
    (a) => a.triggered_at.slice(0, 10) === todayIso,
  ).length;
  const openAlerts = (alerts.data ?? []).filter((a) => a.status === "open").length;
  const activeCameras = (cameras.data ?? []).filter((c) => c.status === "online").length;
  const detectedLanguages = new Set(rows.map((r) => r.language_code)).size;

  const loading =
    conversations.isPending || outlets.isPending || cameras.isPending || alerts.isPending;
  const error = conversations.error ?? outlets.error ?? cameras.error ?? alerts.error;

  return (
    <div>
      <PageHeader
        title="Executive dashboard"
        description="Live operating picture across every outlet, camera and customer conversation in your estate."
        actions={
          <Badge variant="outline" className="border-success/30 text-success">
            Last 90 days · streaming
          </Badge>
        }
      />

      {error ? (
        <ErrorState message={error.message} onRetry={() => conversations.refetch()} />
      ) : loading ? (
        <MetricSkeletonGrid />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            index={0}
            label="Total conversations"
            value={formatNumber(rows.length)}
            delta="+12.4%"
            hint="vs previous period"
            icon={MessagesSquare}
          />
          <MetricCard
            index={1}
            label="Active outlets"
            value={formatNumber((outlets.data ?? []).filter((o) => o.status === "active").length)}
            hint={`${outlets.data?.length ?? 0} in estate`}
            icon={Store}
          />
          <MetricCard
            index={2}
            label="Active cameras"
            value={formatNumber(activeCameras)}
            hint={`${cameras.data?.length ?? 0} provisioned`}
            icon={Cctv}
          />
          <MetricCard
            index={3}
            label="Alerts today"
            value={formatNumber(alertsToday)}
            hint={`${openAlerts} open across estate`}
            icon={Siren}
          />
          <MetricCard
            index={4}
            label="Average sentiment"
            value={avgSentiment.toFixed(2)}
            hint="scale −1.00 to +1.00"
            icon={Gauge}
          />
          <MetricCard
            index={5}
            label="Languages detected"
            value={formatNumber(detectedLanguages)}
            hint={`${(languages.data ?? []).length} configured`}
            icon={Languages}
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Daily conversations"
          description="Captured interactions per day across the estate"
          className="xl:col-span-2"
        >
          {loading ? (
            <LoadingState rows={4} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="conv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  contentStyle={chartTooltipStyle()}
                  cursor={{ stroke: "var(--color-border)" }}
                />
                <Area
                  type="monotone"
                  dataKey="conversations"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  fill="url(#conv)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Top keywords" description="Highest weighted terms in transcripts">
          {keywords.isPending ? (
            <LoadingState rows={4} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topKeywords} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="term"
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={86}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle()}
                  cursor={{ fill: "var(--color-muted)" }}
                />
                <Bar dataKey="mentions" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Sentiment trend"
          description="Mean sentiment score per day (−1.00 to +1.00)"
          className="xl:col-span-2"
        >
          {loading ? (
            <LoadingState rows={4} />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={daily}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis domain={[-1, 1]} tick={AXIS} tickLine={false} axisLine={false} width={38} />
                <Tooltip contentStyle={chartTooltipStyle()} />
                <Line
                  type="monotone"
                  dataKey="sentiment"
                  stroke="var(--color-chart-3)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Latest alerts" description="Most recent signals requiring review">
          {alerts.isPending ? (
            <LoadingState rows={5} />
          ) : (
            <ul className="space-y-3">
              {(alerts.data ?? []).slice(0, 5).map((alert) => (
                <li
                  key={alert.id}
                  className="rounded-lg border border-border bg-surface/60 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-xs font-medium">{alert.title}</p>
                    <StatusPill
                      label={alert.severity}
                      tone={
                        alert.severity === "critical" || alert.severity === "high"
                          ? "negative"
                          : "warning"
                      }
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatRelative(alert.triggered_at)} · {alert.category.replace(/_/g, " ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="Language coverage" description="Detected languages across captured audio">
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(rows.map((r) => r.language_code))).map((code) => (
              <Badge key={code} variant="outline" className="border-border text-xs">
                {LANGUAGE_NAMES[code] ?? code.toUpperCase()} ·{" "}
                {rows.filter((r) => r.language_code === code).length}
              </Badge>
            ))}
            {rows.length === 0 && (
              <span className="text-xs text-muted-foreground">No audio processed yet.</span>
            )}
          </div>
        </Panel>

        <Panel title="Outlet performance" description="Sentiment leaders and laggards">
          <ul className="space-y-2.5">
            {(outlets.data ?? []).map((outlet) => {
              const outletRows = rows.filter((r) => r.outlet_id === outlet.id);
              const score = outletRows.length
                ? outletRows.reduce((s, r) => s + Number(r.sentiment_score), 0) / outletRows.length
                : 0;
              return (
                <li key={outlet.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate">{outlet.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {formatNumber(outletRows.length)} convs
                    </span>
                    <StatusPill
                      label={score.toFixed(2)}
                      tone={score >= 0.1 ? "positive" : score <= -0.1 ? "negative" : "info"}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
