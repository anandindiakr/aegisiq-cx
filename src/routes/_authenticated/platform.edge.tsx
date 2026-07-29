import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plug, ServerCog } from "lucide-react";

import { EmptyState, LoadingState, Panel, StatusPill } from "@/components/common/Primitives";
import { Switch } from "@/components/ui/switch";
import { edgeGatewaysQuery, updateGateway } from "@/features/infrastructure/queries";
import { integrationsQuery, saveIntegration } from "@/features/administration/queries";

export const Route = createFileRoute("/_authenticated/platform/edge")({
  head: () => ({
    meta: [
      { title: "Edge Compute & Connections — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Super admin control of the edge gateway fleet, ingestion and transcription services, and every outbound platform connection.",
      },
      { property: "og:title", content: "Edge Compute & Connections — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Operate edge compute nodes and integration connections from one console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EdgeAndConnections,
});

function statusTone(status: string) {
  if (status === "online" || status === "connected") return "positive" as const;
  if (status === "degraded" || status === "warning") return "warning" as const;
  if (status === "offline" || status === "error") return "negative" as const;
  return "info" as const;
}

function EdgeAndConnections() {
  const queryClient = useQueryClient();
  const gateways = useQuery(edgeGatewaysQuery);
  const integrations = useQuery(integrationsQuery);

  const toggleService = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, boolean> }) =>
      updateGateway(id, patch),
    onSuccess: () => {
      toast.success("Gateway updated");
      void queryClient.invalidateQueries({ queryKey: ["infra"] });
      void queryClient.invalidateQueries({ queryKey: ["edge-gateways"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleIntegration = useMutation({
    mutationFn: ({
      provider,
      category,
      enabled,
      config,
    }: {
      provider: string;
      category: string;
      enabled: boolean;
      config: Record<string, unknown>;
    }) =>
      saveIntegration(provider, category, {
        enabled,
        status: enabled ? "connected" : "disabled",
        config,
      }),
    onSuccess: () => {
      toast.success("Connection updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-integrations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Panel
        title="Edge compute fleet"
        description="Every AI edge gateway registered to the platform, with per-node ingestion and speech services."
      >
        {gateways.isPending ? (
          <LoadingState rows={5} />
        ) : (gateways.data ?? []).length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Gateway</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 pr-3 font-medium">Ingest</th>
                  <th className="pb-2 pr-3 font-medium">Transcription</th>
                  <th className="pb-2 font-medium">Diarization</th>
                </tr>
              </thead>
              <tbody>
                {(gateways.data ?? []).map((gw) => (
                  <tr key={gw.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-3">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <ServerCog className="size-4 text-muted-foreground" /> {gw.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {gw.ip_address ?? "—"} · agent {gw.agent_version ?? "—"}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <StatusPill label={gw.status} tone={statusTone(gw.status)} />
                    </td>
                    <td className="py-3 pr-3">
                      <Switch
                        checked={!!gw.ingest_enabled}
                        onCheckedChange={(v) =>
                          toggleService.mutate({ id: gw.id, patch: { ingest_enabled: v } })
                        }
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <Switch
                        checked={!!gw.transcription_enabled}
                        onCheckedChange={(v) =>
                          toggleService.mutate({ id: gw.id, patch: { transcription_enabled: v } })
                        }
                      />
                    </td>
                    <td className="py-3">
                      <Switch
                        checked={!!gw.diarization_enabled}
                        onCheckedChange={(v) =>
                          toggleService.mutate({ id: gw.id, patch: { diarization_enabled: v } })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No gateways" description="Register an edge gateway to see it here." />
        )}
      </Panel>

      <Panel
        title="Platform connections"
        description="Outbound integrations available to every tenant surface — messaging, cloud and telemetry."
      >
        {integrations.isPending ? (
          <LoadingState rows={4} />
        ) : (integrations.data ?? []).length ? (
          <div className="space-y-2">
            {(integrations.data ?? []).map((conn) => (
              <div
                key={conn.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium capitalize">
                    <Plug className="size-4 text-muted-foreground" /> {conn.provider.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {conn.category.replace(/_/g, " ")} ·{" "}
                    {conn.last_tested_at
                      ? `last tested ${new Date(conn.last_tested_at).toLocaleDateString()}`
                      : "never tested"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill label={conn.status} tone={statusTone(conn.status)} />
                  <Switch
                    checked={conn.enabled}
                    onCheckedChange={(v) =>
                      toggleIntegration.mutate({
                        provider: conn.provider,
                        category: conn.category,
                        enabled: v,
                        config: conn.config ?? {},
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No connections configured"
            description="Configure integrations from Enterprise Administration → Integrations."
          />
        )}
      </Panel>
    </div>
  );
}
