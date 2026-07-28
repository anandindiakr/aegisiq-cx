/**
 * My Executive Reports — personal history of Copilot report runs.
 *
 * Every streamed executive report is recorded here: the command, the period,
 * how long it took, which sections completed, and the finished answer card.
 * A partially completed run can be resumed (only the failed sections re-run)
 * or re-run from scratch.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, PlayCircle, RefreshCw, XCircle } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopilotResponseCard } from "@/components/copilot/CopilotResponseCard";
import { useCopilot } from "@/components/copilot/CopilotProvider";
import {
  REPORT_RUN_STATUS_LABELS,
  copilotReportRunsQuery,
  isResumable,
  type CopilotReportRun,
  type ReportRunStatus,
} from "@/features/copilot/reportRuns";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/copilot/reports")({
  head: () => ({
    meta: [
      { title: "My executive reports — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Every executive report Aegis Copilot generated for you: status, duration, section-level results and one-tap resume or re-run.",
      },
      { property: "og:title", content: "My executive reports — AegisIQ CX™" },
      {
        property: "og:description",
        content:
          "Reopen streamed Copilot report output, resume failed sections or re-run a report with the same parameters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyExecutiveReports,
});

const STATUS_STYLE: Record<ReportRunStatus, { icon: typeof Clock; className: string }> = {
  running: { icon: Clock, className: "text-primary" },
  completed: { icon: CheckCircle2, className: "text-success" },
  partial: { icon: RefreshCw, className: "text-warning" },
  failed: { icon: XCircle, className: "text-destructive" },
};

function RunRow({ run }: { run: CopilotReportRun }) {
  const { run: runCommand, setOpen, busy } = useCopilot();
  const [open, setOpenRow] = useState(false);
  const style = STATUS_STYLE[run.status] ?? STATUS_STYLE.running;
  const Icon = style.icon;
  const sections = run.sections ?? [];
  const done = sections.filter((s) => s.status === "ok").length;

  const execute = (resume: boolean) => {
    setOpen(true);
    void runCommand(run.command, "text", {
      resume: resume ? (run.partial as CopilotReportRun["partial"] as never) : undefined,
    });
  };

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Icon className={`size-4 ${style.className}`} />
            <span className="truncate">{run.command}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {run.range_label ?? "—"} · started {formatDateTime(run.started_at)}
            {run.duration_ms != null && ` · ${Math.round(run.duration_ms / 100) / 10}s`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={style.className}>
            {REPORT_RUN_STATUS_LABELS[run.status]}
          </Badge>
          {sections.length > 0 && (
            <Badge variant="outline">
              {done}/{sections.length} sections
            </Badge>
          )}
          {run.response && (
            <Button size="sm" variant="ghost" onClick={() => setOpenRow((v) => !v)}>
              {open ? "Hide output" : "Reopen output"}
            </Button>
          )}
          {isResumable(run) && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => execute(true)}>
              <RefreshCw className="mr-1 size-3" /> Resume
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => execute(false)}>
            <PlayCircle className="mr-1 size-3" /> Re-run
          </Button>
        </div>
      </div>

      {run.error_message && (
        <p className="mt-2 text-xs text-warning">Incomplete: {run.error_message}</p>
      )}

      {open && run.response && (
        <div className="mt-3">
          <CopilotResponseCard response={run.response} busy={busy} />
        </div>
      )}
    </div>
  );
}

function MyExecutiveReports() {
  const { data, isLoading, isError, error, refetch } = useQuery(copilotReportRunsQuery);
  const [status, setStatus] = useState<string>("all");

  const runs = useMemo(
    () => (data ?? []).filter((run) => status === "all" || run.status === status),
    [data, status],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="My executive reports"
        description="Every executive report Aegis Copilot generated for you — reopen the streamed output, resume failed sections or re-run it."
      />

      <Panel
        title="Report history"
        actions={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(REPORT_RUN_STATUS_LABELS) as ReportRunStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {REPORT_RUN_STATUS_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        {isLoading ? (
          <LoadingState rows={4} />
        ) : isError ? (
          <ErrorState
            message={error instanceof Error ? error.message : "Could not load report history."}
            onRetry={() => void refetch()}
          />
        ) : runs.length === 0 ? (
          <EmptyState
            title="No executive reports yet"
            description="Ask Aegis Copilot to “generate executive report” and every run will appear here."
          />
        ) : (
          <div className="space-y-2.5">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
