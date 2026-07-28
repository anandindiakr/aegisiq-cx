import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, Database, HardDrive } from "lucide-react";

import {
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  storagePoolsQuery,
  updateStoragePool,
  type StoragePool,
} from "@/features/infrastructure/queries";

export const Route = createFileRoute("/_authenticated/infrastructure/storage")({
  head: () => ({
    meta: [
      { title: "Storage & Retention — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Storage pool utilisation, retention windows and archive targets for recordings, transcripts and analytics data.",
      },
      { property: "og:title", content: "Storage & Retention — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Monitor storage pools, retention policies and archive targets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoragePage,
});

function StoragePage() {
  const { data, isPending, error, refetch } = useQuery(storagePoolsQuery);
  const queryClient = useQueryClient();

  const toggleArchive = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateStoragePool(id, { archive_enabled: enabled }),
    onSuccess: () => {
      toast.success("Archive policy updated");
      queryClient.invalidateQueries({ queryKey: ["infrastructure", "storage"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pools = data ?? [];
  const used = pools.reduce((sum, p) => sum + Number(p.used_gb), 0);
  const capacity = pools.reduce((sum, p) => sum + Number(p.capacity_gb), 0);
  const percent = capacity ? (used / capacity) * 100 : 0;
  const archived = pools.filter((p) => p.archive_enabled).length;

  return (
    <div>
      <PageHeader
        title="Storage & Retention"
        description="Where recordings, transcripts and analytics artefacts live, and how long the tenant keeps them."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Database}
          label="Capacity used"
          value={`${(used / 1024).toFixed(1)} TB`}
          hint={`of ${(capacity / 1024).toFixed(1)} TB provisioned`}
        />
        <MetricCard
          icon={HardDrive}
          label="Utilisation"
          value={`${percent.toFixed(0)}%`}
          hint="Across all pools"
        />
        <MetricCard
          icon={Archive}
          label="Archiving pools"
          value={`${archived}/${pools.length}`}
          hint="Cold tier offload enabled"
        />
        <MetricCard
          icon={Database}
          label="Longest retention"
          value={`${pools.reduce((max, p) => Math.max(max, p.retention_days), 0)}d`}
          hint="Compliance retention window"
        />
      </div>

      <div className="mt-5">
        <Panel
          title="Storage pools"
          description="Retention windows are enforced by the nightly lifecycle job on each pool."
        >
          {error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : isPending ? (
            <LoadingState rows={5} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {pools.map((pool) => (
                <PoolCard
                  key={pool.id}
                  pool={pool}
                  onToggle={(enabled) => toggleArchive.mutate({ id: pool.id, enabled })}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function PoolCard({
  pool,
  onToggle,
}: {
  pool: StoragePool;
  onToggle: (enabled: boolean) => void;
}) {
  const percent = Number(pool.capacity_gb)
    ? (Number(pool.used_gb) / Number(pool.capacity_gb)) * 100
    : 0;
  return (
    <div className="panel space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{pool.name}</p>
          <p className="text-[11px] capitalize text-muted-foreground">
            {pool.kind.replace(/_/g, " ")} · {pool.tier} tier
          </p>
        </div>
        <StatusPill
          label={percent > 85 ? "critical" : percent > 70 ? "watch" : "healthy"}
          tone={percent > 85 ? "negative" : percent > 70 ? "warning" : "positive"}
        />
      </div>

      <div>
        <Progress value={percent} className="h-2" />
        <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
          {(Number(pool.used_gb) / 1024).toFixed(2)} TB of{" "}
          {(Number(pool.capacity_gb) / 1024).toFixed(2)} TB · {percent.toFixed(0)}%
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="text-xs font-medium">Retention {pool.retention_days} days</p>
          <p className="text-[11px] text-muted-foreground">
            Archive target: {pool.archive_target ?? "not configured"}
          </p>
        </div>
        <Switch
          checked={pool.archive_enabled}
          aria-label={`Toggle archiving for ${pool.name}`}
          onCheckedChange={onToggle}
        />
      </div>
    </div>
  );
}
