/**
 * Template change history.
 *
 * Every template edit snapshots its resulting state, so this dialog can show
 * what changed between versions and restore an earlier configuration. A
 * rollback is applied as a new version, keeping the history immutable.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/Primitives";
import {
  diffVersions,
  reportTemplatesQuery,
  rollbackReportTemplate,
  templateVersionsQuery,
  type ReportTemplate,
  type ReportTemplateVersion,
} from "@/features/command-centre/reportTemplates";
import { formatDateTime } from "@/lib/format";

export function TemplateHistoryDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ReportTemplate;
}) {
  const queryClient = useQueryClient();
  const versions = useQuery({ ...templateVersionsQuery(template.id), enabled: open });

  const rollback = useMutation({
    mutationFn: (version: ReportTemplateVersion) => rollbackReportTemplate(template, version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reportTemplatesQuery.queryKey });
      await queryClient.invalidateQueries({ queryKey: ["report-template-versions", template.id] });
      toast.success("Template restored", {
        description: "The earlier configuration was applied as a new version.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error("Could not roll back", { description: error.message }),
  });

  const list = versions.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" /> {template.name} — change history
          </DialogTitle>
          <DialogDescription>
            Every edit is versioned. Restore an earlier configuration to reuse it on the next run.
          </DialogDescription>
        </DialogHeader>

        {versions.isLoading ? (
          <LoadingState rows={3} />
        ) : versions.isError ? (
          <ErrorState
            message={
              versions.error instanceof Error ? versions.error.message : "Could not load history."
            }
            onRetry={() => void versions.refetch()}
          />
        ) : list.length === 0 ? (
          <EmptyState
            title="No history yet"
            description="Version snapshots appear here after the first edit."
          />
        ) : (
          <div className="space-y-3">
            {list.map((version, index) => {
              const previous = list[index + 1];
              const changes = previous
                ? diffVersions(previous, version)
                : ["Initial configuration"];
              const isCurrent = version.version === template.version;
              return (
                <div
                  key={version.id}
                  className="rounded-xl border border-border bg-surface/60 p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isCurrent ? "default" : "outline"}>v{version.version}</Badge>
                    {isCurrent && <span className="text-xs text-muted-foreground">Current</span>}
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(version.created_at)}
                      {version.author_name ? ` · ${version.author_name}` : ""}
                    </span>
                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        disabled={rollback.isPending}
                        onClick={() => rollback.mutate(version)}
                      >
                        <RotateCcw className="mr-1.5 size-3.5" /> Restore
                      </Button>
                    )}
                  </div>
                  {version.change_summary && (
                    <p className="mt-1.5 text-sm text-foreground">{version.change_summary}</p>
                  )}
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    {changes.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {version.sections.length} sections ·{" "}
                    {(version.formats ?? []).join(", ").toUpperCase() || "no formats"} ·{" "}
                    {(version.language ?? "en").toUpperCase()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
