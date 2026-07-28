import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink, Trash2, UserCheck, XCircle } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState, StatusPill } from "@/components/common/Primitives";
import { formatDateTime, formatRelative, titleCase } from "@/lib/format";
import { staffQuery } from "@/features/platform/queries";
import type { AlertRow, AlertStatus, StaffProfile } from "@/features/platform/queries";
import {
  addAlertNote,
  alertNotesQuery,
  assignAlert,
  bulkUpdateAlertStatus,
  deleteAlertNote,
} from "@/features/live-monitor/queries";

export type TriageAlert = AlertRow & {
  assigned_to?: string | null;
  assigned_at?: string | null;
};

const SEVERITY_TONE: Record<string, "negative" | "warning" | "info" | "neutral"> = {
  critical: "negative",
  high: "negative",
  medium: "warning",
  low: "info",
  info: "neutral",
};

const UNASSIGNED = "__unassigned__";

export function AlertTriageSheet({
  alert,
  outletName,
  authorName,
  onOpenChange,
}: {
  alert: TriageAlert | null;
  outletName: (id: string | null) => string;
  authorName: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const notes = useQuery(alertNotesQuery(alert?.id ?? null));
  const staff = useQuery(staffQuery);

  const refreshAlerts = () => {
    void queryClient.invalidateQueries({ queryKey: ["alerts"] });
  };

  const statusChange = useMutation({
    mutationFn: (status: AlertStatus) => bulkUpdateAlertStatus([alert!.id], status),
    onSuccess: (_d, status) => {
      toast.success(`Alert ${status}`);
      refreshAlerts();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: (userId: string | null) => assignAlert(alert!.id, userId),
    onSuccess: () => {
      toast.success("Assignment updated");
      refreshAlerts();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createNote = useMutation({
    mutationFn: () => addAlertNote(alert!.id, body.trim(), authorName),
    onSuccess: () => {
      setBody("");
      toast.success("Note added");
      void queryClient.invalidateQueries({ queryKey: ["live-monitor", "alert-notes", alert?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeNote = useMutation({
    mutationFn: (id: string) => deleteAlertNote(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["live-monitor", "alert-notes", alert?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignable = (staff.data ?? []).filter((s: StaffProfile) => Boolean(s.user_id));

  return (
    <Sheet open={Boolean(alert)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {alert && (
          <>
            <SheetHeader className="border-b border-border px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  label={alert.severity}
                  tone={SEVERITY_TONE[alert.severity] ?? "neutral"}
                />
                <StatusPill label={alert.status} />
                <span className="text-[11px] text-muted-foreground">
                  {titleCase(alert.category)}
                </span>
              </div>
              <SheetTitle className="mt-2 text-base">{alert.title}</SheetTitle>
              <SheetDescription>
                {outletName(alert.outlet_id)} · triggered {formatDateTime(alert.triggered_at)}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-5 py-5">
              <p className="text-sm text-muted-foreground">
                {alert.description ?? "No additional detail was captured for this signal."}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={statusChange.isPending || alert.status === "acknowledged"}
                  onClick={() => statusChange.mutate("acknowledged")}
                >
                  <UserCheck className="mr-2 size-4" /> Acknowledge
                </Button>
                <Button
                  size="sm"
                  disabled={statusChange.isPending || alert.status === "resolved"}
                  onClick={() => statusChange.mutate("resolved")}
                >
                  <CheckCircle2 className="mr-2 size-4" /> Resolve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={statusChange.isPending || alert.status === "dismissed"}
                  onClick={() => statusChange.mutate("dismissed")}
                >
                  <XCircle className="mr-2 size-4" /> Dismiss
                </Button>
                {alert.conversation_id && (
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      to="/conversationiq/$conversationId"
                      params={{ conversationId: alert.conversation_id }}
                    >
                      <ExternalLink className="mr-2 size-4" /> Open conversation
                    </Link>
                  </Button>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Owner
                </p>
                <Select
                  value={alert.assigned_to ?? UNASSIGNED}
                  onValueChange={(v) => assign.mutate(v === UNASSIGNED ? null : v)}
                >
                  <SelectTrigger className="bg-surface">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {assignable.map((person) => (
                      <SelectItem key={person.id} value={person.user_id as string}>
                        {person.full_name} · {titleCase(person.directory_role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {alert.assigned_at && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Assigned {formatRelative(alert.assigned_at)}
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Triage notes
                </p>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Record what you checked, who you contacted and the outcome…"
                  className="min-h-24 bg-surface"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    disabled={body.trim().length === 0 || createNote.isPending}
                    onClick={() => createNote.mutate()}
                  >
                    Add note
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {notes.isPending ? (
                    <LoadingState rows={2} />
                  ) : (notes.data ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No notes recorded yet.</p>
                  ) : (
                    (notes.data ?? []).map((note) => (
                      <div
                        key={note.id}
                        className="rounded-lg border border-border bg-surface/50 px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">
                            {note.author_name ?? "Team member"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">
                              {formatRelative(note.created_at)}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6"
                              aria-label="Delete note"
                              onClick={() => removeNote.mutate(note.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                          {note.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
