import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DatabaseBackup, Download, Play, Trash2 } from "lucide-react";

import { ErrorState, LoadingState, Panel, StatusPill } from "@/components/common/Primitives";
import { SettingsForm } from "@/components/administration/SettingsForm";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  backupRunsQuery,
  createBackupRun,
  deleteBackupRun,
  SECTION_DEFAULTS,
  settingsQuery,
} from "@/features/administration/queries";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/administration/backup")({
  component: BackupPage,
});

const SCOPES = [
  { value: "full", label: "Full workspace" },
  { value: "configuration", label: "Configuration only" },
  { value: "conversations", label: "Conversations & transcripts" },
];

function BackupPage() {
  const { data, isPending, error, refetch } = useQuery(backupRunsQuery);
  const settings = useQuery(settingsQuery("backup"));
  const queryClient = useQueryClient();

  const retention = Number(
    (settings.data ?? SECTION_DEFAULTS.backup).retention_days ?? 30,
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-backup-runs"] });

  const run = useMutation({
    mutationFn: (scope: string) => createBackupRun(scope, retention),
    onSuccess: () => {
      toast.success("Backup completed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBackupRun(id),
    onSuccess: () => {
      toast.success("Backup record removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <SettingsForm
        section="backup"
        groups={[
          {
            title: "Automatic backups",
            description: "Scheduled protection for configuration and conversation archives",
            fields: [
              { key: "automatic", label: "Enable automatic backups", type: "switch" },
              {
                key: "frequency",
                label: "Frequency",
                type: "select",
                options: [
                  { value: "hourly", label: "Hourly" },
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ],
              },
              { key: "time_of_day", label: "Run at", type: "text", placeholder: "02:00" },
              {
                key: "retention_days",
                label: "Retention (days)",
                type: "number",
                min: 1,
                max: 3650,
              },
              {
                key: "archive_target",
                label: "Archive destination",
                type: "text",
                full: true,
                placeholder: "cold-storage://aegisiq/backups",
              },
              { key: "encrypt", label: "Encrypt archives at rest", type: "switch" },
            ],
          },
        ]}
      />

      <Panel
        title="Run a backup now"
        description={`Manual runs inherit the ${retention}-day retention policy`}
      >
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((scope) => (
            <Button
              key={scope.value}
              variant="outline"
              disabled={run.isPending}
              onClick={() => run.mutate(scope.value)}
            >
              <Play className="mr-2 size-4" /> {scope.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel title="Backup history" description="Most recent 50 runs for this workspace">
        {isPending ? (
          <LoadingState rows={5} />
        ) : (data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No backups recorded yet. Run one above or enable the automatic schedule.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(row.started_at)}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 text-sm capitalize">
                        <DatabaseBackup className="size-4 text-primary" />
                        {row.kind}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{row.scope}</TableCell>
                    <TableCell className="text-sm tabular-nums">{row.size_mb} MB</TableCell>
                    <TableCell className="text-sm tabular-nums">{row.retention_days} days</TableCell>
                    <TableCell>
                      <StatusPill
                        label={row.status}
                        tone={
                          row.status === "completed"
                            ? "positive"
                            : row.status === "failed"
                              ? "negative"
                              : "warning"
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Copy archive location"
                          disabled={!row.archive_location}
                          onClick={() => {
                            void navigator.clipboard.writeText(row.archive_location ?? "");
                            toast.success("Archive location copied");
                          }}
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete backup record"
                          onClick={() => remove.mutate(row.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
