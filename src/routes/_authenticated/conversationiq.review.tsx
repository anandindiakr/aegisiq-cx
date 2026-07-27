import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Clock3, Gauge, TrendingUp } from "lucide-react";

import { MetricCard, PageHeader, Panel } from "@/components/common/Primitives";
import { Chip, languageName } from "@/components/conversationiq/Badges";
import { ConversationIqTabs } from "@/components/conversationiq/ModuleTabs";
import { iqConversationsQuery, iqKeywordIndexQuery } from "@/features/conversationiq/queries";
import { formatDuration, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conversationiq/review")({
  head: () => ({
    meta: [
      { title: "AI Review — ConversationIQ™ | AegisIQ CX" },
      {
        name: "description",
        content:
          "Executive review of conversation volume, sentiment trend, language mix, complaint and escalation rates.",
      },
      { property: "og:title", content: "AI Review — ConversationIQ™" },
      {
        property: "og:description",
        content: "Executive conversation intelligence review across the estate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiReviewPage,
});

const CHART_COLORS = [
  "var(--color-primary)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-destructive)",
];

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  fontSize: "12px",
} as const;

function AiReviewPage() {
  const conversations = useQuery(iqConversationsQuery);
  const keywordIndex = useQuery(iqKeywordIndexQuery);
  const rows = useMemo(() => conversations.data ?? [], [conversations.data]);

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return { sentiment: 0, duration: 0, complaintRate: 0, escalationRate: 0 };
    }
    const sentiment = rows.reduce((sum, r) => sum + Number(r.sentiment_score), 0) / rows.length;
    const duration = rows.reduce((sum, r) => sum + r.duration_seconds, 0) / rows.length;
    const complaints = rows.filter(
      (r) => r.sentiment === "negative" || r.sentiment === "very_negative",
    ).length;
    const escalations = rows.filter((r) => r.escalated).length;
    return {
      sentiment,
      duration: Math.round(duration),
      complaintRate: (complaints / rows.length) * 100,
      escalationRate: (escalations / rows.length) * 100,
    };
  }, [rows]);

  const volume = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const row of rows) {
      const key = row.started_at.slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([day, count]) => ({ day: day.slice(5), count }));
  }, [rows]);

  const sentimentTrend = useMemo(() => {
    const byDay = new Map<string, { total: number; count: number }>();
    for (const row of rows) {
      const key = row.started_at.slice(0, 10);
      const entry = byDay.get(key) ?? { total: 0, count: 0 };
      entry.total += Number(row.sentiment_score);
      entry.count += 1;
      byDay.set(key, entry);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([day, v]) => ({ day: day.slice(5), score: Number((v.total / v.count).toFixed(2)) }));
  }, [rows]);

  const languageMix = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.language_code, (counts.get(row.language_code) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([code, value]) => ({ name: languageName(code), value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const riskMix = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0 };
    for (const row of rows) counts[row.risk_level] += 1;
    return [
      { name: "Low", value: counts.low },
      { name: "Medium", value: counts.medium },
      { name: "High", value: counts.high },
    ];
  }, [rows]);

  const topKeywords = useMemo(
    () =>
      Array.from(keywordIndex.data?.counts.entries() ?? [])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12),
    [keywordIndex.data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Review"
        description="Executive summary of conversation intelligence across the last 1,000 captured interactions."
      />
      <ConversationIqTabs />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Average sentiment"
          value={stats.sentiment.toFixed(2)}
          hint="Scale −1 to +1"
          icon={Gauge}
          index={0}
        />
        <MetricCard
          label="Average duration"
          value={formatDuration(stats.duration)}
          hint="Per conversation"
          icon={Clock3}
          index={1}
        />
        <MetricCard
          label="Complaint rate"
          value={`${stats.complaintRate.toFixed(1)}%`}
          hint="Negative sentiment share"
          icon={AlertTriangle}
          index={2}
        />
        <MetricCard
          label="Escalation rate"
          value={`${stats.escalationRate.toFixed(1)}%`}
          hint="Escalated to manager"
          icon={TrendingUp}
          index={3}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Conversation volume"
          description="Captured conversations per day (last 30 days)."
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={volume}>
              <defs>
                <linearGradient id="iq-volume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={32} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-primary)"
                fill="url(#iq-volume)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Language distribution" description="Primary detected language share.">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={languageMix}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
              >
                {languageMix.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {languageMix.map((entry, index) => (
              <span
                key={entry.name}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                />
                {entry.name} · {formatNumber(entry.value)}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Sentiment trend" description="Daily average sentiment score.">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={sentimentTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis
                domain={[-1, 1]}
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                width={38}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--color-info)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Risk distribution" description="Conversations by assessed risk level.">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={riskMix}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={42} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "var(--color-muted)", opacity: 0.15 }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {riskMix.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={
                      ["var(--color-success)", "var(--color-warning)", "var(--color-destructive)"][
                        index
                      ]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Top keywords" description="Most frequently detected terms across the corpus.">
          <div className="flex flex-wrap gap-2">
            {topKeywords.map(([keyword, count]) => (
              <Chip key={keyword} tone="info">
                {keyword}
                <span className="opacity-60">{formatNumber(count)}</span>
              </Chip>
            ))}
            {topKeywords.length === 0 && (
              <p className="text-sm text-muted-foreground">No keyword detections yet.</p>
            )}
          </div>
        </Panel>
        <Panel title="Top languages" description="Ranked by conversation volume.">
          <ul className="space-y-2">
            {languageMix.map((entry) => (
              <li key={entry.name} className="flex items-center gap-3">
                <span className="w-20 text-xs text-muted-foreground">{entry.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${(entry.value / (languageMix[0]?.value || 1)) * 100}%` }}
                  />
                </span>
                <span className="w-12 text-right text-xs">{formatNumber(entry.value)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
