import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlarmClock, Check, Clock, Hourglass, Loader2, ShieldQuestion, X } from "lucide-react";
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
import {
  accessRequestSla,
  approveWidgetAccess,
  averageTurnaround,
  denyWidgetAccess,
  expireStaleAccessRequests,
  expireWidgetAccess,
  formatMinutes,
  widgetAccessRequestsQuery,
  type WidgetAccessRequest,
} from "@/features/command-centre/accessRequests";
import { WIDGETS } from "@/features/command-centre/widgets";

const LABELS = new Map(WIDGETS.map((w) => [w.id, w.label]));

/**
 * Admin review queue for widget access requests. Approving adds the requester's
 * roles to the widget rule the database evaluates, so the widget and its deep
 * links unlock immediately.
 */
export function WidgetAccessRequests() {
  const queryClient = useQueryClient();
  const requests = useQuery(widgetAccessRequestsQuery);
  const rows = requests.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const breached = pending.filter((r) => accessRequestSla(r).state === "breached");
  const median = averageTurnaround(rows);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: widgetAccessRequestsQuery.queryKey });
    await queryClient.invalidateQueries({ queryKey: ["command-centre", "allowed-widgets"] });
    await queryClient.invalidateQueries({ queryKey: ["command-centre", "can-view-widget"] });
  };

  const approve = useMutation({
    mutationFn: (request: WidgetAccessRequest) => approveWidgetAccess(request),
    onSuccess: async () => {
      await refresh();
      toast.success("Access granted");
    },
    onError: (error: Error) => toast.error("Could not approve", { description: error.message }),
  });

  const expireOne = useMutation({
    mutationFn: (request: WidgetAccessRequest) => expireWidgetAccess(request),
    onSuccess: async () => {
      await refresh();
      toast.success("Request expired");
    },
    onError: (error: Error) => toast.error("Could not expire", { description: error.message }),
  });

  const expireStale = useMutation({
    mutationFn: expireStaleAccessRequests,
    onSuccess: async (count: number) => {
      await refresh();
      toast.success(
        count === 0 ? "Nothing to expire" : `${count} stale request${count === 1 ? "" : "s"} expired`,
      );
    },
    onError: (error: Error) => toast.error("Could not expire", { description: error.message }),
  });

  const deny = useMutation({
    mutationFn: (request: WidgetAccessRequest) => denyWidgetAccess(request),
    onSuccess: async () => {
      await refresh();
      toast.success("Request denied");
    },
    onError: (error: Error) => toast.error("Could not deny", { description: error.message }),
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ShieldQuestion className="size-4" />
          Access requests
          {pending.length > 0 && (
            <span
              className={
                breached.length > 0
                  ? "rounded-full bg-destructive/15 px-1.5 text-[10px] tabular-nums text-destructive"
                  : "rounded-full bg-primary/15 px-1.5 text-[10px] tabular-nums text-primary"
              }
            >
              {pending.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Widget access requests</DialogTitle>
          <DialogDescription>
            Approving a request grants the requester&apos;s roles access to that widget and its
            ConversationIQ drill-downs.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface/40 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <Hourglass className="size-3.5" />
              {pending.length} pending
            </span>
            <span className="flex items-center gap-1.5 text-destructive">
              <AlarmClock className="size-3.5" />
              {breached.length} past SLA
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              Median turnaround {median === null ? "—" : formatMinutes(median)}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            disabled={expireStale.isPending}
            onClick={() => expireStale.mutate()}
          >
            {expireStale.isPending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
            Expire stale requests
          </Button>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 pr-3">
            {requests.isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 inline size-4 animate-spin" />
                Loading requests…
              </p>
            )}
            {!requests.isLoading && rows.length === 0 && (
              <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                No access requests yet.
              </p>
            )}
            {rows.map((request) => (
              <div
                key={request.id}
                className="rounded-lg border border-border/70 bg-surface/40 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {LABELS.get(request.widget_id) ?? request.widget_id}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {request.requester_name ?? request.requester_email ?? "Unknown user"} ·{" "}
                      {new Date(request.created_at).toLocaleString("en-GB")}
                    </p>
                    {request.reason && (
                      <p className="mt-1.5 text-xs text-muted-foreground">{request.reason}</p>
                    )}
                    {request.status === "pending" &&
                      (() => {
                        const sla = accessRequestSla(request);
                        return (
                          <p
                            className={
                              sla.state === "breached"
                                ? "mt-1.5 text-[11px] font-medium text-destructive"
                                : sla.state === "due_soon"
                                  ? "mt-1.5 text-[11px] font-medium text-warning"
                                  : "mt-1.5 text-[11px] text-muted-foreground"
                            }
                          >
                            {sla.label} · target {formatMinutes(request.sla_minutes ?? 480)} ·
                            waiting {formatMinutes(sla.turnaroundMinutes)}
                          </p>
                        );
                      })()}
                    {request.status !== "pending" && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {request.status === "approved"
                          ? "Approved"
                          : request.status === "expired"
                            ? "Expired"
                            : "Denied"}{" "}
                        {request.status === "expired"
                          ? ""
                          : `by ${request.decided_by_name ?? "an admin"} `}
                        after {formatMinutes(accessRequestSla(request).turnaroundMinutes)}
                        {request.decision_note ? ` — ${request.decision_note}` : ""}
                      </p>
                    )}
                  </div>
                  {request.status === "pending" ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-success"
                        disabled={approve.isPending}
                        onClick={() => approve.mutate(request)}
                        aria-label="Approve request"
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        disabled={deny.isPending}
                        onClick={() => deny.mutate(request)}
                        aria-label="Deny request"
                      >
                        <X className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        disabled={expireOne.isPending}
                        onClick={() => expireOne.mutate(request)}
                        aria-label="Expire request"
                      >
                        <Hourglass className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                      {request.status}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
