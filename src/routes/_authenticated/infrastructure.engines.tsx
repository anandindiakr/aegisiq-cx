import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Brain, Gauge, ShieldCheck } from "lucide-react";

import {
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { InfraChangeHistory } from "@/components/infrastructure/InfraChangeHistory";
import { SpeechPipeline } from "@/components/infrastructure/SpeechPipeline";
import { aiEnginesQuery, updateEngine, type AiEngine } from "@/features/infrastructure/queries";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/infrastructure/engines")({
  head: () => ({
    meta: [
      { title: "AI Engine Registry — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Registry of speech and language engines — Whisper, Deepgram, Azure Speech, OpenAI and translation — with health, latency and enablement controls.",
      },
      { property: "og:title", content: "AI Engine Registry — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Manage the speech-to-text, translation and reasoning engines behind AegisIQ CX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiEnginesPage,
});

function AiEnginesPage() {
  const { data, isPending, error, refetch } = useQuery(aiEnginesQuery);
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateEngine(id, { enabled }),
    onSuccess: () => {
      toast.success("Engine updated");
      queryClient.invalidateQueries({ queryKey: ["infrastructure", "engines"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="AI Engine Registry"
        description="Every speech, translation and reasoning engine wired into the AegisIQ intelligence plane, with health and latency SLOs."
      />

      <Panel
        title="Engines"
        description="Enablement here controls which providers the edge agents may route work to."
      >
        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isPending ? (
          <LoadingState rows={6} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(data ?? []).map((engine) => (
              <EngineCard
                key={engine.id}
                engine={engine}
                onToggle={(enabled) => toggle.mutate({ id: engine.id, enabled })}
              />
            ))}
          </div>
        )}
      </Panel>

      <div className="mt-5">
        <InfraChangeHistory
          scope={["ai_engine"]}
          title="Engine change history"
          description="Enablement, endpoint, version and health-policy changes with the person responsible."
        />
      </div>

      <div className="mt-5">
        <Panel
          title="Speech processing pipeline"
          description="How captured audio flows from the camera microphone to conversation intelligence."
        >
          <SpeechPipeline />
        </Panel>
      </div>
    </div>
  );
}

function EngineCard({
  engine,
  onToggle,
}: {
  engine: AiEngine;
  onToggle: (enabled: boolean) => void;
}) {
  const healthy = engine.health === "healthy";
  return (
    <div className="panel space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
            <Brain className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{engine.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {engine.provider} · {engine.capability.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        <Switch
          checked={engine.enabled}
          aria-label={`Enable ${engine.name}`}
          onCheckedChange={onToggle}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label={engine.health} tone={healthy ? "positive" : "warning"} />
        <Badge variant="outline" className="border-border text-[11px] text-muted-foreground">
          v{engine.version}
        </Badge>
        {engine.region && (
          <Badge variant="outline" className="border-border text-[11px] text-muted-foreground">
            {engine.region}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Gauge className="size-3.5" /> {engine.latency_ms}ms p95
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" />
          {engine.api_configured ? "API key configured" : "Key required"}
        </span>
        <span className="col-span-2 truncate font-mono">{engine.endpoint ?? "—"}</span>
        <span className="col-span-2">Last tested {formatRelative(engine.last_tested_at)}</span>
      </div>
    </div>
  );
}
