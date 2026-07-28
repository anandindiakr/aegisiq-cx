import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Brain, Download, Gauge, ShieldCheck, SlidersHorizontal } from "lucide-react";

import {
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkEngineConfigDialog } from "@/components/infrastructure/BulkEngineConfigDialog";
import { useInfraAccess } from "@/features/infrastructure/access";
import { downloadCsv, enginesToCsv } from "@/features/infrastructure/pipeline";
import { InfraChangeHistory } from "@/components/infrastructure/InfraChangeHistory";
import { SpeechPipeline } from "@/components/infrastructure/SpeechPipeline";
import { aiEnginesQuery, updateEngine, type AiEngine } from "@/features/infrastructure/queries";
import { formatRelative } from "@/lib/format";
import { useState } from "react";

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
  const access = useInfraAccess();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const engines = data ?? [];
  const selectedEngines = engines.filter((engine) => selected.includes(engine.id));

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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Checkbox
              checked={engines.length > 0 && selected.length === engines.length}
              aria-label="Select all engines"
              onCheckedChange={(checked) =>
                setSelected(checked ? engines.map((engine) => engine.id) : [])
              }
            />
            <span className="text-xs text-muted-foreground">
              {selected.length ? `${selected.length} selected` : "Select all"}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={selected.length === 0}
              onClick={() => {
                downloadCsv(
                  `aegisiq-ai-engines-${new Date().toISOString().slice(0, 10)}.csv`,
                  enginesToCsv(selectedEngines),
                );
                toast.success(`Exported ${selectedEngines.length} engines`);
              }}
            >
              <Download className="mr-2 size-4" /> Export
            </Button>
            <Button
              size="sm"
              disabled={selected.length === 0 || !access.can("operate")}
              onClick={() => setBulkOpen(true)}
            >
              <SlidersHorizontal className="mr-2 size-4" /> Bulk configure
            </Button>
          </div>
        }
      >
        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isPending ? (
          <LoadingState rows={6} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {engines.map((engine) => (
              <EngineCard
                key={engine.id}
                engine={engine}
                selected={selected.includes(engine.id)}
                canOperate={access.can("operate")}
                onSelect={(checked) =>
                  setSelected((current) =>
                    checked
                      ? [...new Set([...current, engine.id])]
                      : current.filter((id) => id !== engine.id),
                  )
                }
                onToggle={(enabled) => toggle.mutate({ id: engine.id, enabled })}
              />
            ))}
          </div>
        )}
      </Panel>

      <BulkEngineConfigDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        engines={selectedEngines}
        onApplied={() => setSelected([])}
      />

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
  selected,
  canOperate,
  onSelect,
  onToggle,
}: {
  engine: AiEngine;
  selected: boolean;
  canOperate: boolean;
  onSelect: (checked: boolean) => void;
  onToggle: (enabled: boolean) => void;
}) {
  const healthy = engine.health === "healthy";
  return (
    <div
      className={`panel space-y-3 p-4 ${selected ? "border-primary/50 ring-1 ring-primary/30" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Checkbox
            checked={selected}
            className="mt-1"
            aria-label={`Select ${engine.name}`}
            onCheckedChange={(checked) => onSelect(checked === true)}
          />
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
          disabled={!canOperate}
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
