import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  CircleSlash,
  Eye,
  ListChecks,
  Loader2,
  Mail,
  Timer,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, Panel } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Chip } from "@/components/conversationiq/Badges";
import { ConversationIqTabs } from "@/components/conversationiq/ModuleTabs";
import {
  QUEUE_PRIORITIES,
  QUEUE_STATUSES,
  SLA_PRESETS,
  deleteAssignment,
  formatSla,
  reviewQueueQuery,
  slaMinutesLeft,
  slaState,
  updateAssignment,
  type QueuePriority,
  type QueueStatus,
  type ReviewAssignment,
} from "@/features/conversationiq/queue";
import { useSlaWatch } from "@/features/conversationiq/sla";
import {
  notificationPreferencesQuery,
  saveNotificationPreferences,
} from "@/features/conversationiq/notifications";
import { useIqAccess } from "@/features/conversationiq/access";
import { staffQuery } from "@/features/platform/queries";

import { formatDate, formatNumber, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conversationiq/queue")({
  head: () => ({
    meta: [
      { title: "Reviewer Queue — ConversationIQ™ | AegisIQ CX" },
      {
        name: "description",
        content:
          "Assign conversations and alerts to reviewers, track open, in-progress and completed work and monitor SLA breaches.",
      },
      { property: "og:title", content: "Reviewer Queue — ConversationIQ™" },
      {
        property: "og:description",
        content: "Team review workflow with assignment, status tracking and SLA monitoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewerQueuePage,
});

const STATUS_TONE: Record<QueueStatus, "neutral" | "info" | "positive" | "warning"> = {
  open: "warning",
  in_progress: "info",
  done: "positive",
  cancelled: "neutral",
};

const PRIORITY_TONE: Record<QueuePriority, "neutral" | "info" | "warning" | "negative"> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "negative",
};

function ReviewerQueuePage() {
  const queryClient = useQueryClient();
  const queue = useQuery(reviewQueueQuery);
  const sla = useSlaWatch();
  const prefs = useQuery(notificationPreferencesQuery);
  const emailAlerts = prefs.data?.sla_email ?? false;
  const access = useIqAccess();

  const staff = useQuery(staffQuery);

  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["iq", "review-queue"] });
  }

  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof updateAssignment>[1] }) =>
      updateAssignment(input.id, input.patch),
    onMutate: (input) => setBusyId(input.id),
    onSettled: () => setBusyId(null),
    onSuccess: () => {
      toast.success("Queue item updated");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      toast.success("Queue item removed");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = queue.data ?? [];

  const rows = useMemo(
    () =>
      items.filter((item) => {
        if (statusFilter === "active" && (item.status === "done" || item.status === "cancelled")) {
          return false;
        }
        if (statusFilter === "breached" && slaState(item) !== "breached") return false;
        if (
          statusFilter !== "active" &&
          statusFilter !== "all" &&
          statusFilter !== "breached" &&
          item.status !== statusFilter
        ) {
          return false;
        }
        if (assigneeFilter === "unassigned" && item.assignee_id) return false;
        if (
          assigneeFilter !== "all" &&
          assigneeFilter !== "unassigned" &&
          item.assignee_id !== assigneeFilter
        ) {
          return false;
        }
        return true;
      }),
    [items, statusFilter, assigneeFilter],
  );

  const stats = useMemo(() => {
    const open = items.filter((i) => i.status === "open").length;
    const progress = items.filter((i) => i.status === "in_progress").length;
    const done = items.filter((i) => i.status === "done").length;
    const breached = items.filter((i) => slaState(i) === "breached").length;
    return { open, progress, done, breached };
  }, [items]);

  const assignees = staff.data ?? [];

  function assign(item: ReviewAssignment, value: string) {
    if (value === "unassigned") {
      update.mutate({ id: item.id, patch: { assigneeId: null, assigneeName: null } });
      return;
    }
    const person = assignees.find((p) => p.user_id === value || p.id === value);
    update.mutate({
      id: item.id,
      patch: { assigneeId: value, assigneeName: person?.full_name ?? null },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviewer Queue"
        description="Assign conversations and alerts to your review team, track progress and keep every case inside its service-level target."
      />
      <ConversationIqTabs />

      <div className="panel flex flex-wrap items-center justify-between gap-3 border-l-2 border-l-primary/60 p-4">
        <div className="flex items-start gap-3">
          <TriangleAlert
            className={
              sla.breached.length > 0
                ? "mt-0.5 size-5 text-destructive"
                : "mt-0.5 size-5 text-muted-foreground"
            }
          />
          <div>
            <p className="text-sm font-medium">
              {sla.breached.length > 0
                ? `${formatNumber(sla.breached.length)} item${sla.breached.length === 1 ? "" : "s"} past SLA`
                : "All active work is inside its SLA"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(sla.dueSoon.length)} due soon · monitored every minute with in-app
              notifications.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={emailAlerts ? "default" : "outline"}
            size="sm"
            onClick={() => {
              const next = !emailAlerts;
              void saveNotificationPreferences({ sla_email: next })
                .then(() => {
                  void prefs.refetch();
                  toast.success(next ? "Email escalations enabled" : "Email escalations disabled", {
                    description: next
                      ? "Breached items can now be sent as an escalation email digest."
                      : "You will only receive in-app notifications.",
                  });
                })
                .catch((error: Error) => toast.error(error.message));
            }}
          >
            <Mail className="mr-2 size-4" /> Email escalations {emailAlerts ? "on" : "off"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!emailAlerts || sla.breached.length === 0}
            onClick={() => {
              const body = sla.breached
                .map(
                  (item) =>
                    `- ${item.title} | ${item.priority} | ${item.assignee_name ?? "Unassigned"} | ${formatSla(slaMinutesLeft(item))}`,
                )
                .join("\n");
              window.location.href = `mailto:?subject=${encodeURIComponent(
                `AegisIQ CX — ${sla.breached.length} SLA breaches`,
              )}&body=${encodeURIComponent(body)}`;
            }}
          >
            Send breach digest
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Open", value: stats.open, icon: ListChecks, tone: "warning" as const },
          { label: "In progress", value: stats.progress, icon: Timer, tone: "info" as const },
          { label: "Done", value: stats.done, icon: ListChecks, tone: "positive" as const },
          {
            label: "SLA breached",
            value: stats.breached,
            icon: AlarmClock,
            tone: "negative" as const,
          },
        ].map((card) => (
          <div key={card.label} className="panel p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                {card.label}
              </span>
              <card.icon className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{formatNumber(card.value)}</p>
            <Chip tone={card.tone}>{card.label}</Chip>
          </div>
        ))}
      </div>

      <Panel
        title={`${formatNumber(rows.length)} queue items`}
        description="Items are created from the conversation list, the viewer or automatically from linked alerts."
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-48 bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active work</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="breached">SLA breached</SelectItem>
              {QUEUE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {titleCase(status.replace("_", " "))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-9 w-56 bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reviewers</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {assignees
                .filter((p) => p.user_id)
                .map((person) => (
                  <SelectItem key={person.id} value={person.user_id as string}>
                    {person.full_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {queue.isLoading && <p className="text-sm text-muted-foreground">Loading queue…</p>}
        {!queue.isLoading && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <CircleSlash className="size-6" />
            <p className="text-sm">
              Nothing in the queue for this filter. Select conversations in ConversationIQ™ and use
              “Bulk review → Add to reviewer queue”.
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {rows.map((item) => {
            const left = slaMinutesLeft(item);
            const state = slaState(item);
            return (
              <li
                key={item.id}
                className="rounded-lg border border-border bg-surface/50 p-4 transition-colors hover:bg-surface/70"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Created {formatDate(item.created_at)} · due {formatDate(item.due_at)} ·{" "}
                      {item.sla_minutes}m SLA
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={PRIORITY_TONE[item.priority]}>{titleCase(item.priority)}</Chip>
                    <Chip tone={STATUS_TONE[item.status]}>
                      {titleCase(item.status.replace("_", " "))}
                    </Chip>
                    <Chip
                      tone={
                        state === "breached"
                          ? "negative"
                          : state === "due_soon"
                            ? "warning"
                            : state === "met"
                              ? "positive"
                              : "neutral"
                      }
                    >
                      <Timer className="size-3" /> {formatSla(left)}
                    </Chip>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserRound className="size-3.5" />
                    {item.assignee_name ?? "Unassigned"}
                  </span>
                  <Select
                    value={item.assignee_id ?? "unassigned"}
                    disabled={!access.can("assignQueue")}
                    onValueChange={(value) => assign(item, value)}
                  >
                    <SelectTrigger className="h-8 w-48 bg-surface text-xs">
                      <SelectValue placeholder="Assign reviewer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {assignees
                        .filter((p) => p.user_id)
                        .map((person) => (
                          <SelectItem key={person.id} value={person.user_id as string}>
                            {person.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={item.status}
                    disabled={!access.can("moveQueue")}
                    onValueChange={(value) =>
                      update.mutate({ id: item.id, patch: { status: value as QueueStatus } })
                    }
                  >
                    <SelectTrigger className="h-8 w-40 bg-surface text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUEUE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {titleCase(status.replace("_", " "))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={item.priority}
                    disabled={!access.can("moveQueue")}
                    onValueChange={(value) =>
                      update.mutate({
                        id: item.id,
                        patch: {
                          priority: value as QueuePriority,
                          slaMinutes: SLA_PRESETS[value as QueuePriority],
                        },
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-36 bg-surface text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUEUE_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {titleCase(priority)} · {SLA_PRESETS[priority]}m
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {busyId === item.id && <Loader2 className="size-4 animate-spin text-primary" />}
                  <div className="ml-auto flex items-center gap-1">
                    {item.conversation_id && (
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          to="/conversationiq/$conversationId"
                          params={{ conversationId: item.conversation_id }}
                        >
                          <Eye className="mr-1.5 size-4" /> Open
                        </Link>
                      </Button>
                    )}
                    {access.can("moveQueue") && (
                      <Button variant="ghost" size="sm" onClick={() => remove.mutate(item.id)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
