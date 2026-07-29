import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { MeteredUsageDashboard } from "@/components/administration/MeteredUsage";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { platformUsageQuery } from "@/features/administration/usageAlerts";

export const Route = createFileRoute("/_authenticated/platform/usage")({
  head: () => ({
    meta: [
      { title: "Platform Metered Usage — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Super admin view of Copilot queries, audio minutes, storage, egress and remaining allowances per outlet and per tenant.",
      },
      { property: "og:title", content: "Platform Metered Usage — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Cross-estate consumption metering for the AegisIQ CX platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlatformUsagePage,
});

const nf = new Intl.NumberFormat("en-SG");

/** Cross-tenant consumption, above the workspace-scoped dashboard. */
function CrossTenantPanel() {
  const { data, isPending, error, refetch } = useQuery(platformUsageQuery);
  return (
    <Panel
      title="Cross-tenant consumption"
      description="Every workspace on the platform for the current billing cycle"
    >
      {isPending ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : data?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Tenant</th>
                <th className="pb-2 pr-3 font-medium">Queries</th>
                <th className="pb-2 pr-3 font-medium">Audio min</th>
                <th className="pb-2 pr-3 font-medium">Storage</th>
                <th className="pb-2 pr-3 font-medium">Egress</th>
                <th className="pb-2 font-medium">Allowance</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const pct = row.included_queries
                  ? Math.round((row.queries / row.included_queries) * 100)
                  : 0;
                return (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-3 text-sm font-medium">{row.name}</td>
                    <td className="py-3 pr-3 text-sm tabular-nums">{nf.format(row.queries)}</td>
                    <td className="py-3 pr-3 text-sm tabular-nums">
                      {nf.format(Math.round(row.audio_minutes))}
                    </td>
                    <td className="py-3 pr-3 text-sm tabular-nums">{row.storage_gb} GB</td>
                    <td className="py-3 pr-3 text-sm tabular-nums">{row.egress_gb} GB</td>
                    <td className="py-3">
                      <StatusPill
                        label={`${pct}% used`}
                        tone={pct >= 100 ? "negative" : pct >= 85 ? "warning" : "positive"}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No tenants metered"
          description="Consumption appears once workspaces start processing."
        />
      )}
    </Panel>
  );
}

function PlatformUsagePage() {
  return (
    <div className="space-y-6">
      <CrossTenantPanel />
      <MeteredUsageDashboard />
    </div>
  );
}
