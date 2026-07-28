import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileClock, Send, XCircle } from "lucide-react";

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
import { exportAuditCsv, exportAuditQuery } from "@/features/command-centre/exportAudit";

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
  const failures = rows.filter((row) => row.status === "failed").length;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) void queryClient.invalidateQueries({ queryKey: exportAuditQuery.queryKey });
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

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {rows.length} recorded run{rows.length === 1 ? "" : "s"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={rows.length === 0}
            onClick={() =>
              download(
                `export-history-${new Date().toISOString().slice(0, 10)}.csv`,
                exportAuditCsv(rows),
              )
            }
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>

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
              </article>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
