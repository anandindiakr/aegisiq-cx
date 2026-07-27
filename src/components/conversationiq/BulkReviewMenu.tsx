import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCheck,
  ChevronDown,
  ListPlus,
  Loader2,
  PlayCircle,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { bulkReviewConversations, type BulkAction } from "@/features/conversationiq/review";
import {
  QUEUE_STATUSES,
  bulkQueueConversations,
  createAssignments,
  type BulkQueuePatch,
  type QueueStatus,
} from "@/features/conversationiq/queue";
import { staffQuery } from "@/features/platform/queries";
import { useQuery } from "@tanstack/react-query";
import { titleCase } from "@/lib/format";
import type { IqConversation } from "@/features/conversationiq/queries";
import type { AlertRow } from "@/features/platform/queries";

/**
 * Bulk review actions for the current selection. Only the underlying data
 * changes — filters, sorting, pagination and the selection itself are kept so
 * the reviewer stays exactly where they were.
 */
export function BulkReviewMenu({
  selected,
  rows,
  alerts,
}: {
  selected: string[];
  rows: IqConversation[];
  alerts: Map<string, AlertRow[]>;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const staff = useQuery(staffQuery);
  const titles = new Map(
    selected.map((id) => [id, byId.get(id) ? `Review ${byId.get(id)!.reference}` : "Review conversation"]),
  );

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["iq"] });
    void queryClient.invalidateQueries({ queryKey: ["alerts"] });
  }

  const review = useMutation({
    mutationFn: (action: BulkAction) =>
      bulkReviewConversations({ conversationIds: selected, action }),
    onMutate: (action) => setPending(action),
    onSettled: () => setPending(null),
    onSuccess: (result, action) => {
      toast.success(
        `${result.conversations} conversation${result.conversations > 1 ? "s" : ""} marked ${action}`,
        {
          description:
            result.alerts > 0
              ? `${result.alerts} linked alert${result.alerts > 1 ? "s" : ""} updated with an audit entry.`
              : "No linked alerts required a status change.",
        },
      );
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const enqueue = useMutation({
    mutationFn: () =>
      createAssignments(
        selected.map((id) => {
          const row = byId.get(id);
          const linked = alerts.get(id) ?? [];
          const critical = linked.find((a) => a.severity === "critical" || a.severity === "high");
          return {
            conversationId: id,
            alertId: linked[0]?.id ?? null,
            title: row ? `Review ${row.reference}` : "Review conversation",
            priority: critical ? ("high" as const) : ("normal" as const),
          };
        }),
      ),
    onMutate: () => setPending("queue"),
    onSettled: () => setPending(null),
    onSuccess: (count) => {
      toast.success(`${count} item${count === 1 ? "" : "s"} added to the reviewer queue`, {
        description: count < selected.length ? "Already-queued alerts were skipped." : undefined,
      });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const queueMutation = useMutation({
    mutationFn: (input: { key: string; patch: BulkQueuePatch }) =>
      bulkQueueConversations(selected, input.patch, titles),
    onMutate: (input) => setPending(input.key),
    onSettled: () => setPending(null),
    onSuccess: (result) => {
      toast.success(
        `${result.updated + result.created} queue item${
          result.updated + result.created === 1 ? "" : "s"
        } updated`,
        {
          description:
            result.created > 0
              ? `${result.created} conversation${result.created === 1 ? " was" : "s were"} added to the queue automatically.`
              : "Filters, sorting and pagination are unchanged.",
        },
      );
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy = pending !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={selected.length === 0 || busy}>
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 size-4" />
          )}
          Bulk review{selected.length > 0 ? ` (${selected.length})` : ""}
          <ChevronDown className="ml-1 size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Apply to {selected.length} selected</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => review.mutate("acknowledged")}>
          <CheckCheck className="mr-2 size-4" /> Acknowledge
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => review.mutate("resolved")}>
          <ShieldCheck className="mr-2 size-4" /> Resolve
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => review.mutate("dismissed")}>
          <XCircle className="mr-2 size-4" /> Dismiss
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => enqueue.mutate()}>
          <ListPlus className="mr-2 size-4" /> Add to reviewer queue
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <UserRound className="mr-2 size-4" /> Assign reviewer
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 w-56 overflow-auto">
            <DropdownMenuItem
              onSelect={() =>
                queueMutation.mutate({
                  key: "unassign",
                  patch: { assigneeId: null, assigneeName: null },
                })
              }
            >
              Unassigned
            </DropdownMenuItem>
            {(staff.data ?? [])
              .filter((person) => person.user_id)
              .map((person) => (
                <DropdownMenuItem
                  key={person.id}
                  onSelect={() =>
                    queueMutation.mutate({
                      key: `assign-${person.id}`,
                      patch: {
                        assigneeId: person.user_id,
                        assigneeName: person.full_name,
                      },
                    })
                  }
                >
                  {person.full_name}
                </DropdownMenuItem>
              ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <PlayCircle className="mr-2 size-4" /> Move queue state
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            {QUEUE_STATUSES.map((status) => (
              <DropdownMenuItem
                key={status}
                onSelect={() =>
                  queueMutation.mutate({
                    key: `status-${status}`,
                    patch: { status: status as QueueStatus },
                  })
                }
              >
                {titleCase(status.replace("_", " "))}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
