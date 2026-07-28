import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, PlayCircle, TriangleAlert, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import {
  DIAGNOSTICS,
  evaluateDiagnostic,
  type DiagnosticResult,
} from "@/features/infrastructure/pipeline";
import {
  logInfraEvent,
  type AiEngine,
  type AudioStream,
  type EdgeGateway,
  type InfraCamera,
} from "@/features/infrastructure/queries";

const ICON = {
  passed: CheckCircle2,
  warning: TriangleAlert,
  failed: XCircle,
} as const;

const TONE = {
  passed: "text-success",
  warning: "text-warning",
  failed: "text-destructive",
} as const;

/** Professional diagnostics console for the infrastructure estate. */
export function TestCentre({
  cameras,
  gateways,
  engines,
  streams,
}: {
  cameras: InfraCamera[];
  gateways: EdgeGateway[];
  engines: AiEngine[];
  streams: AudioStream[];
}) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const run = (id: string) => {
    setRunning(id);
    window.setTimeout(async () => {
      const result = evaluateDiagnostic(id, { cameras, gateways, engines, streams });
      setResults((prev) => [result, ...prev].slice(0, 12));
      setRunning(null);
      const definition = DIAGNOSTICS.find((d) => d.id === id);
      try {
        await logInfraEvent({
          source: definition?.source ?? "connection",
          level: result.status === "passed" ? "info" : result.status === "warning" ? "warn" : "error",
          message: `${result.label}: ${result.detail}`,
        });
        queryClient.invalidateQueries({ queryKey: ["infrastructure", "events"] });
      } catch {
        // Logging is best-effort; the diagnostic verdict is already on screen.
      }
    }, 700);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {DIAGNOSTICS.map((diagnostic) => (
          <Button
            key={diagnostic.id}
            variant="outline"
            className="h-auto justify-start gap-3 px-3 py-2.5 text-left"
            disabled={running !== null}
            onClick={() => run(diagnostic.id)}
          >
            {running === diagnostic.id ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : (
              <PlayCircle className="size-4 shrink-0 text-primary" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{diagnostic.label}</span>
              <span className="block truncate text-[11px] font-normal text-muted-foreground">
                {diagnostic.description}
              </span>
            </span>
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Diagnostic history
        </p>
        {results.length === 0 ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Run a diagnostic to see verdicts, timings and remediation hints here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {results.map((result, index) => {
              const Icon = ICON[result.status];
              return (
                <li
                  key={`${result.id}-${result.at}-${index}`}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5"
                >
                  <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[result.status])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{result.label}</p>
                    <p className="text-xs text-muted-foreground">{result.detail}</p>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {result.durationMs}ms · {formatRelative(result.at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
