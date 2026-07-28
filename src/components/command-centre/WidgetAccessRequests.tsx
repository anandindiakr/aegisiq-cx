import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ShieldQuestion, X } from "lucide-react";
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
  approveWidgetAccess,
  denyWidgetAccess,
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
            <span className="rounded-full bg-primary/15 px-1.5 text-[10px] tabular-nums text-primary">
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
                    {request.status !== "pending" && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {request.status === "approved" ? "Approved" : "Denied"} by{" "}
                        {request.decided_by_name ?? "an admin"}
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
