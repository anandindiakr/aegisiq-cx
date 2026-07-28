import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Timer,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoadingState, StatusPill } from "@/components/common/Primitives";
import { SlaTimer } from "@/components/alerts/SlaTimer";
import { ConversationReplayPanel } from "@/components/alerts/ConversationReplayPanel";
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
import { alertEscalationsQuery, alertSlaPoliciesQuery, describeMinutes } from "@/features/alerts/sla";
import { useAlertAccess, type AlertAction } from "@/features/alerts/access";

export type TriageAlert = AlertRow & {
  assigned_to?: string | null;
  assigned_at?: string | null;
  resolved_at?: string | null;
  sla_breached?: boolean;
  escalation_level?: number;
  escalated_at?: string | null;
};

const SEVERITY_TONE: Record<string, "negative" | "warning" | "info" | "neutral"> = {
  critical: "negative",
  high: "negative",
  medium: "warning",
  low: "info",
  info: "neutral",
};

const UNASSIGNED = "__unassigned__";

/** Wraps an action control so a blocked user sees why it is unavailable. */
function Gated({
  reason,
  children,
}: {
  reason: string | null;
  children: React.ReactNode;
}) {
  if (!reason) return <>{children}</>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-not-allowed opacity-50">{children}</span>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
  const policies = useQuery(alertSlaPoliciesQuery);
  const escalations = useQuery(alertEscalationsQuery(alert?.id ?? null));
  const access = useAlertAccess();

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
  const policy = alert ? policies.data?.get(alert.severity) : undefined;
  const deny = (action: AlertAction) => (alert ? access.denyReason(action, alert.outlet_id) : null);

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
                <SlaTimer alert={alert} policy={policy} />
                {(alert.escalation_level ?? 0) > 0 && (
                  <StatusPill label={`escalated L${alert.escalation_level}`} tone="negative" />
                )}
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
                <Gated reason={deny("acknowledge")}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      Boolean(deny("acknowledge")) ||
                      statusChange.isPending ||
                      alert.status === "acknowledged"
                    }
                    onClick={() => statusChange.mutate("acknowledged")}
                  >
                    <UserCheck className="mr-2 size-4" /> Acknowledge
                  </Button>
                </Gated>
                <Gated reason={deny("resolve")}>
                  <Button
                    size="sm"
                    disabled={
                      Boolean(deny("resolve")) ||
                      statusChange.isPending ||
                      alert.status === "resolved"
                    }
                    onClick={() => statusChange.mutate("resolved")}
                  >
                    <CheckCircle2 className="mr-2 size-4" /> Resolve
                  </Button>
                </Gated>
                <Gated reason={deny("dismiss")}>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={
                      Boolean(deny("dismiss")) ||
                      statusChange.isPending ||
                      alert.status === "dismissed"
                    }
                    onClick={() => statusChange.mutate("dismissed")}
                  >
                    <XCircle className="mr-2 size-4" /> Dismiss
                  </Button>
                </Gated>
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

              {/* SLA + escalation trail */}
              <div className="rounded-lg border border-border bg-surface/50 px-3 py-3">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  <Timer className="size-3.5" /> SLA
                </p>
                {policy ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Acknowledge within {describeMinutes(policy.ack_minutes)} · resolve within{" "}
                    {describeMinutes(policy.resolve_minutes)} · auto-escalate after{" "}
                    {describeMinutes(policy.escalate_after_minutes)}
                    {policy.backup_role ? ` to ${titleCase(policy.backup_role)}` : ""}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    No SLA policy is configured for {alert.severity} alerts.
                  </p>
                )}
                {(escalations.data ?? []).length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {(escalations.data ?? []).map((event) => (
                      <li key={event.id} className="flex items-start gap-2 text-xs">
                        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                        <span className="text-muted-foreground">
                          <span className="text-foreground">Level {event.level}</span> ·{" "}
                          {event.reason} · handed to{" "}
                          {event.to_user_name ??
                            (event.to_role ? titleCase(event.to_role) : "backup owner")}{" "}
                          · {describeMinutes(event.minutes_overdue)} overdue ·{" "}
                          {formatRelative(event.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {alert.conversation_id && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Conversation replay
                  </p>
                  <ConversationReplayPanel
                    conversationId={alert.conversation_id}
                    alertTriggeredAt={alert.triggered_at}
                  />
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Owner
                </p>
                <Gated reason={deny("assign")}>
                  <Select
                    value={alert.assigned_to ?? UNASSIGNED}
                    disabled={Boolean(deny("assign"))}
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
                </Gated>
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
