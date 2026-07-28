import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileClock, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  attemptsFor,
  exportAuditCsv,
  exportAuditQuery,
  isRetryable,
  type ExportAuditEvent,
} from "@/features/command-centre/exportAudit";
import {
  ACTION_LABELS,
  exportActionsCsv,
  exportActionsQuery,
} from "@/features/command-centre/exportActions";
import { retryExportRun } from "@/features/command-centre/exportRetry";

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Immutable history of every export run and scheduled report delivery, with the
 * output format, template version, recipients and success/failure outcome.
 */
export function ExportHistory() {
  const queryClient = useQueryClient();
  const history = useQuery(exportAuditQuery);
  const rows = useMemo(() => history.data ?? [], [history.data]);
  const actions = useQuery(exportActionsQuery);
  const actionRows = useMemo(() => actions.data ?? [], [actions.data]);
  const [tab, setTab] = useState("runs");
  const failures = rows.filter((row) => isRetryable(row, rows)).length;

  const retry = useMutation({
    mutationFn: (row: ExportAuditEvent) => retryExportRun(row),
    onSuccess: async (outcome) => {
      await queryClient.invalidateQueries({ queryKey: exportAuditQuery.queryKey });
      await queryClient.invalidateQueries({ queryKey: exportActionsQuery.queryKey });
      toast.success(
        outcome === "replayed" ? "Delivery re-sent" : "Export re-run from the current view",
      );
    },
    onError: (error: Error) => toast.error("Retry failed", { description: error.message }),
  });

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          void queryClient.invalidateQueries({ queryKey: exportAuditQuery.queryKey });
          void queryClient.invalidateQueries({ queryKey: exportActionsQuery.queryKey });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileClock className="size-4" />
          Export history
          {failures > 0 && (
            <span className="rounded-full bg-destructive/15 px-1.5 text-[10px] tabular-nums text-destructive">
              {failures}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export & delivery history</DialogTitle>
          <DialogDescription>
            Every generated report and scheduled delivery, including format, template version,
            recipients and outcome.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList className="h-8">
              <TabsTrigger value="runs" className="text-xs">
                Runs ({rows.length})
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs">
                Action trail ({actionRows.length})
              </TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={tab === "runs" ? rows.length === 0 : actionRows.length === 0}
              onClick={() =>
                download(
                  `${tab === "runs" ? "export-history" : "export-actions"}-${new Date()
                    .toISOString()
                    .slice(0, 10)}.csv`,
                  tab === "runs" ? exportAuditCsv(rows) : exportActionsCsv(actionRows),
                )
              }
            >
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>

          <TabsContent value="actions" className="mt-3">
            <ScrollArea className="max-h-[55vh] pr-3">
              <div className="space-y-2">
                {actionRows.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No export activity recorded yet.
                  </p>
                )}
                {actionRows.map((event) => (
                  <article
                    key={event.id}
                    className="rounded-lg border border-border/70 bg-surface/40 p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={event.outcome === "failed" ? "destructive" : "outline"}
                        className="text-[10px]"
                      >
                        {ACTION_LABELS[event.action] ?? event.action}
                      </Badge>
                      <span className="font-medium">{event.actor_name ?? "System"}</span>
                      {event.format && (
                        <span className="text-[11px] text-muted-foreground">
                          {event.format.toUpperCase()}
                        </span>
                      )}
                      {event.template_name && (
                        <Badge variant="secondary" className="text-[10px]">
                          {event.template_name} v{event.template_version ?? 1}
                        </Badge>
                      )}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {new Date(event.created_at).toLocaleString("en-GB")}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {event.surface}
                      {event.widget_id ? ` · widget: ${event.widget_id}` : ""}
                      {event.recipients.length > 0
                        ? ` · recipients: ${event.recipients.join(", ")}`
                        : ""}
                      {event.detail ? ` · ${event.detail}` : ""}
                    </p>
                  </article>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="runs" className="mt-3">
            <ScrollArea className="max-h-[55vh] pr-3">
              <div className="space-y-2">
                {history.isLoading && (
                  <p className="py-6 text-center text-xs text-muted-foreground">Loading history…</p>
                )}
                {!history.isLoading && rows.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No exports have been run yet.
                  </p>
                )}
                {rows.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-lg border border-border/70 bg-surface/40 p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {row.status === "success" ? (
                        <CheckCircle2 className="size-4 text-emerald-400" />
                      ) : (
                        <XCircle className="size-4 text-destructive" />
                      )}
                      <span className="font-medium">{row.format.toUpperCase()}</span>
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        {row.kind === "delivery" ? <Send className="size-2.5" /> : null}
                        {row.kind === "delivery" ? "Scheduled delivery" : "Manual export"}
                      </Badge>
                      {row.template_name && (
                        <Badge variant="secondary" className="text-[10px]">
                          {row.template_name} v{row.template_version ?? 1}
                        </Badge>
                      )}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {new Date(row.created_at).toLocaleString("en-GB")}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {row.actor_name ?? "System"}
                      {row.duration_ms !== null && ` · ${row.duration_ms}ms`}
                      {row.sections.length > 0 && ` · sections: ${row.sections.join(", ")}`}
                    </p>
                    {row.recipients.length > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Recipients: {row.recipients.join(", ")}
                      </p>
                    )}
                    {row.error_message && (
                      <p className="mt-1 text-[11px] text-destructive">{row.error_message}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        Attempt {row.attempt ?? 1} of {attemptsFor(row, rows)}
                        {row.auto_retry ? " · automatic" : ""}
                      </span>
                      {isRetryable(row, rows) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto h-7 gap-1.5 text-[11px]"
                          disabled={retry.isPending}
                          onClick={() => retry.mutate(row)}
                        >
                          {retry.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3" />
                          )}
                          Retry {row.kind === "delivery" ? "delivery" : "export"}
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
