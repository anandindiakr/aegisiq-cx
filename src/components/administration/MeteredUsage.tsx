/**
 * Metered usage dashboard.
 *
 * Shared by Enterprise Administration (tenant view) and the Platform Console
 * (super admin view): Copilot queries, audio minutes, storage and egress
 * against the workspace allowance, broken down per outlet.
 */
import { useQuery } from "@tanstack/react-query";
import { AudioLines, Bot, Database, Gauge, HardDrive, Wallet } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  MetricCard,
  MetricSkeletonGrid,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Progress } from "@/components/ui/progress";
import { TrendAreaChart } from "@/components/command-centre/charts";
import { usageOverviewQuery, type UsageOutletRow } from "@/features/administration/usage";

const nf = new Intl.NumberFormat("en-SG");

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: currency || "SGD",
    maximumFractionDigits: 0,
  }).format(value);
}

function pct(used: number, allowance: number) {
  if (!allowance) return 0;
  return Math.min(999, Math.round((used / allowance) * 100));
}

function tone(value: number) {
  if (value >= 100) return "negative" as const;
  if (value >= 85) return "warning" as const;
  return "positive" as const;
}

function OutletRow({ row }: { row: UsageOutletRow }) {
  const queryPct = pct(row.queries, row.query_limit);
  const audioPct = pct(row.audio_minutes, row.audio_minutes_limit);
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="py-3 pr-3">
        <p className="text-sm font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">
          {row.code ?? "—"} · {row.region ?? "—"}
        </p>
      </td>
      <td className="py-3 pr-3 tabular-nums">
        <p className="text-sm">
          {nf.format(row.queries)}
          <span className="text-muted-foreground"> / {nf.format(row.query_limit)}</span>
        </p>
        <Progress value={Math.min(100, queryPct)} className="mt-1.5 h-1.5" />
      </td>
      <td className="py-3 pr-3 tabular-nums">
        <p className="text-sm">
          {nf.format(Math.round(row.audio_minutes))}
          <span className="text-muted-foreground"> / {nf.format(row.audio_minutes_limit)} min</span>
        </p>
        <Progress value={Math.min(100, audioPct)} className="mt-1.5 h-1.5" />
      </td>
      <td className="py-3 pr-3 text-sm tabular-nums">{row.storage_gb.toFixed(1)} GB</td>
      <td className="py-3 pr-3 text-sm tabular-nums">{row.egress_gb.toFixed(1)} GB</td>
      <td className="py-3">
        <StatusPill
          label={
            queryPct >= 100 ? "exhausted" : queryPct >= 85 ? "near limit" : row.throttle_enabled ? "metered" : "unmetered"
          }
          tone={queryPct >= 100 ? "negative" : queryPct >= 85 ? "warning" : "info"}
        />
      </td>
    </tr>
  );
}

export function MeteredUsageDashboard() {
  const { data, isPending, error, refetch } = useQuery(usageOverviewQuery);

  if (isPending) return <MetricSkeletonGrid count={6} />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />;
  if (!data) return <EmptyState title="No usage recorded yet" description="Consumption appears once the workspace starts processing conversations." />;

  const plan = data.plan;
  const currency = plan?.currency ?? "SGD";
  const totals = data.totals;

  const queryPct = pct(totals.queries, plan?.included_queries ?? 0);
  const audioPct = pct(totals.audio_minutes, plan?.included_audio_minutes ?? 0);
  const storagePct = pct(totals.storage_gb, plan?.included_storage_gb ?? 0);
  const egressPct = pct(totals.egress_gb, plan?.included_egress_gb ?? 0);

  const overageQueries = Math.max(0, totals.queries - (plan?.included_queries ?? 0));
  const overageAudio = Math.max(0, totals.audio_minutes - (plan?.included_audio_minutes ?? 0));
  const overageStorage = Math.max(0, totals.storage_gb - (plan?.included_storage_gb ?? 0));
  const overageEgress = Math.max(0, totals.egress_gb - (plan?.included_egress_gb ?? 0));
  const overageCost =
    overageQueries * (plan?.overage_query_price ?? 0) +
    overageAudio * (plan?.overage_audio_minute_price ?? 0) +
    overageStorage * (plan?.overage_storage_gb_price ?? 0) +
    overageEgress * (plan?.overage_egress_gb_price ?? 0);

  const trend = data.trend.map((point) => ({
    label: new Date(point.period_month).toLocaleDateString("en-SG", { month: "short" }),
    value: Number(point.queries ?? 0),
    secondary: Math.round(Number(point.audio_minutes ?? 0)),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Copilot queries"
          value={nf.format(totals.queries)}
          hint={`${queryPct}% of ${nf.format(plan?.included_queries ?? 0)} included`}
          icon={Bot}
          index={0}
        />
        <MetricCard
          label="Audio minutes"
          value={nf.format(Math.round(totals.audio_minutes))}
          hint={`${audioPct}% of ${nf.format(plan?.included_audio_minutes ?? 0)} included`}
          icon={AudioLines}
          index={1}
        />
        <MetricCard
          label="Storage"
          value={`${totals.storage_gb.toFixed(1)} GB`}
          hint={`${storagePct}% of ${nf.format(plan?.included_storage_gb ?? 0)} GB`}
          icon={HardDrive}
          index={2}
        />
        <MetricCard
          label="Egress"
          value={`${totals.egress_gb.toFixed(1)} GB`}
          hint={`${egressPct}% of ${nf.format(plan?.included_egress_gb ?? 0)} GB`}
          icon={Database}
          index={3}
        />
        <MetricCard
          label="AI tokens"
          value={nf.format(totals.ai_tokens)}
          hint="Gateway tokens consumed this cycle"
          icon={Gauge}
          index={4}
        />
        <MetricCard
          label="Projected overage"
          value={money(overageCost, currency)}
          hint={`Budget ${money(plan?.monthly_budget ?? 0, currency)} · ${plan?.throttle_mode ?? "off"} throttling`}
          icon={Wallet}
          index={5}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="Consumption trend"
          description="Copilot queries and audio minutes across the last six billing cycles"
        >
          {trend.length ? (
            <TrendAreaChart data={trend} valueName="Queries" secondaryName="Audio minutes" />
          ) : (
            <EmptyState title="No history yet" description="Trends appear after the first full billing cycle." />
          )}
        </Panel>

        <Panel title="Remaining allowances" description="Workspace entitlement for this cycle">
          <div className="space-y-4">
            {[
              { label: "Copilot queries", used: queryPct, remaining: Math.max(0, (plan?.included_queries ?? 0) - totals.queries), unit: "queries" },
              { label: "Audio minutes", used: audioPct, remaining: Math.max(0, (plan?.included_audio_minutes ?? 0) - totals.audio_minutes), unit: "min" },
              { label: "Storage", used: storagePct, remaining: Math.max(0, (plan?.included_storage_gb ?? 0) - totals.storage_gb), unit: "GB" },
              { label: "Egress", used: egressPct, remaining: Math.max(0, (plan?.included_egress_gb ?? 0) - totals.egress_gb), unit: "GB" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <StatusPill label={`${row.used}% used`} tone={tone(row.used)} />
                </div>
                <Progress value={Math.min(100, row.used)} className="mt-2 h-2" />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {nf.format(Math.round(row.remaining))} {row.unit} remaining
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Per-outlet metering"
        description="Consumption and quota headroom for every outlet in this workspace"
      >
        {data.outlets.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Outlet</th>
                  <th className="pb-2 pr-3 font-medium">Copilot queries</th>
                  <th className="pb-2 pr-3 font-medium">Audio minutes</th>
                  <th className="pb-2 pr-3 font-medium">Storage</th>
                  <th className="pb-2 pr-3 font-medium">Egress</th>
                  <th className="pb-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {data.outlets.map((row) => (
                  <OutletRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No outlets" description="Add outlets to see per-site metering." />
        )}
      </Panel>
    </div>
  );
}
