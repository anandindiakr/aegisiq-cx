import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, History, Loader2, Siren } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Panel } from "@/components/common/Primitives";
import { Chip } from "@/components/conversationiq/Badges";
import { alertEventsQuery, reviewAlert } from "@/features/conversationiq/review";
import type { AlertRow, AlertStatus } from "@/features/platform/queries";
import { formatDate, titleCase } from "@/lib/format";

const STATUSES: AlertStatus[] = ["open", "acknowledged", "resolved", "dismissed"];

function severityTone(severity: string) {
  if (severity === "critical" || severity === "high") return "negative" as const;
  if (severity === "medium") return "warning" as const;
  return "neutral" as const;
}

function statusTone(status: AlertStatus) {
  if (status === "open") return "negative" as const;
  if (status === "acknowledged") return "warning" as const;
  if (status === "resolved") return "positive" as const;
  return "neutral" as const;
}

/**
 * In-page alert review: acknowledge, change status and inspect the immutable
 * activity trail without leaving the conversation viewer.
 */
export function AlertReviewPanel({
  alerts,
  conversationId,
}: {
  alerts: AlertRow[];
  conversationId: string;
}) {
  const queryClient = useQueryClient();
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const alertIds = alerts.map((a) => a.id);
  const history = useQuery(alertEventsQuery(alertIds));

  const mutation = useMutation({
    mutationFn: reviewAlert,
    onSuccess: (_data, variables) => {
      toast.success(`Alert marked ${titleCase(variables.toStatus)}`);
      setNotes((prev) => ({ ...prev, [variables.alertId]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["iq", "conversation", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["iq", "alert-index"] });
      void queryClient.invalidateQueries({ queryKey: ["iq", "alert-events"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (alerts.length === 0) {
    return (
      <Panel title="Alert review" description="No alerts were raised for this conversation.">
        <p className="text-sm text-muted-foreground">
          Alerts triggered by keywords, risk or escalation appear here for acknowledgement.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Alert review"
      description={`${alerts.length} alert${alerts.length > 1 ? "s" : ""} linked to this conversation.`}
    >
      <div className="space-y-3">
        {alerts.map((alert) => {
          const events = (history.data ?? []).filter((e) => e.alert_id === alert.id);
          const isOpen = openHistory === alert.id;
          const pending = mutation.isPending && mutation.variables?.alertId === alert.id;
          return (
            <div key={alert.id} className="rounded-lg border border-border bg-surface/50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Siren className="size-3.5 text-destructive" /> {alert.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {alert.description ?? "No description recorded."}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock3 className="size-3" /> {formatDate(alert.triggered_at)} ·{" "}
                    {alert.category}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Chip tone={severityTone(alert.severity)}>{titleCase(alert.severity)}</Chip>
                  <Chip tone={statusTone(alert.status)}>{titleCase(alert.status)}</Chip>
                </div>
              </div>

              <Textarea
                value={notes[alert.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [alert.id]: e.target.value }))}
                placeholder="Optional review note recorded with the status change…"
                className="mt-3 min-h-16 bg-surface text-xs"
              />

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={pending || alert.status === "acknowledged"}
                  onClick={() =>
                    mutation.mutate({
                      alertId: alert.id,
                      fromStatus: alert.status,
                      toStatus: "acknowledged",
                      note: notes[alert.id],
                    })
                  }
                >
                  {pending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                  Acknowledge
                </Button>
                <Select
                  value={alert.status}
                  onValueChange={(value) =>
                    mutation.mutate({
                      alertId: alert.id,
                      fromStatus: alert.status,
                      toStatus: value as AlertStatus,
                      note: notes[alert.id],
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-40 bg-surface text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {titleCase(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenHistory(isOpen ? null : alert.id)}
                >
                  <History className="mr-2 size-3.5" />
                  {isOpen ? "Hide history" : `History (${events.length})`}
                </Button>
              </div>

              {isOpen && (
                <ol className="mt-3 space-y-2 border-l border-border pl-4">
                  {history.isLoading && (
                    <li className="text-xs text-muted-foreground">Loading history…</li>
                  )}
                  {!history.isLoading && events.length === 0 && (
                    <li className="text-xs text-muted-foreground">
                      No status changes recorded yet — the alert is still in its original state.
                    </li>
                  )}
                  {events.map((event) => (
                    <li key={event.id} className="relative text-xs">
                      <span className="absolute -left-[1.18rem] top-1.5 size-2 rounded-full border border-primary/50 bg-primary/40" />
                      <span className="font-medium">
                        {event.from_status ? `${titleCase(event.from_status)} → ` : ""}
                        {titleCase(event.to_status)}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {event.actor_name ?? "System"} · {formatDate(event.created_at)}
                      </span>
                      {event.note && <p className="mt-0.5 text-muted-foreground">{event.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
