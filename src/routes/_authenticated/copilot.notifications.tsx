/**
 * Copilot report notifications.
 *
 * A focused settings surface for the two events an executive cares about while
 * a report streams: `report.completed` and `report.failed`. Channels created
 * here are ordinary notification rules scoped to those events, so the general
 * Notifications page and the server-side fan-out keep working unchanged.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Mail, Plus, Send, Trash2, Webhook } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHANNEL_LABELS,
  EVENT_LABELS,
  type NotificationChannel,
  type NotificationEvent,
} from "@/features/command-centre/notificationEvents";
import {
  deleteNotificationRule,
  notificationDeliveriesQuery,
  notificationRulesQuery,
  saveNotificationRule,
  sendTestNotification,
  type NotificationRule,
  type SampleDeliveryResult,
} from "@/features/command-centre/notificationChannels";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/copilot/notifications")({
  head: () => ({
    meta: [
      { title: "Copilot report notifications — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Choose the email recipients and Slack or Teams webhooks that are notified when an Aegis Copilot executive report completes or fails.",
      },
      { property: "og:title", content: "Copilot report notifications — AegisIQ CX™" },
      {
        property: "og:description",
        content:
          "Manage the delivery channels for streamed executive report outcomes in AegisIQ CX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CopilotNotifications,
});

const REPORT_EVENTS: NotificationEvent[] = ["report.completed", "report.failed"];

const CHANNELS: NotificationChannel[] = ["email", "slack", "teams", "webhook"];

const PLACEHOLDER: Record<NotificationChannel, string> = {
  email: "cxo@yourcompany.com",
  slack: "https://hooks.slack.com/services/T000/B000/XXXX",
  teams: "https://outlook.office.com/webhook/…",
  webhook: "https://ops.yourcompany.com/hooks/aegisiq",
};

/** A rule counts as a copilot channel when it listens to any report event. */
function isReportRule(rule: NotificationRule): boolean {
  return (rule.events ?? []).some((event) => REPORT_EVENTS.includes(event));
}

function ChannelForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<NotificationChannel>("email");
  const [destination, setDestination] = useState("");
  const [events, setEvents] = useState<NotificationEvent[]>([...REPORT_EVENTS]);

  const save = useMutation({
    mutationFn: () =>
      saveNotificationRule({
        name: name.trim() || `${CHANNEL_LABELS[channel]} — report outcomes`,
        channel,
        destination,
        events,
        recipientUserIds: [],
        active: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-rules"] });
      toast.success("Report notification channel added");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const valid =
    destination.trim().length > 3 &&
    events.length > 0 &&
    (channel !== "email" || destination.includes("@")) &&
    (channel === "email" || destination.trim().startsWith("https://"));

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input
            value={name}
            placeholder="CEO inbox"
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select value={channel} onValueChange={(next) => setChannel(next as NotificationChannel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((key) => (
                <SelectItem key={key} value={key}>
                  {CHANNEL_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{channel === "email" ? "Recipient" : "Webhook URL"}</Label>
          <Input
            value={destination}
            placeholder={PLACEHOLDER[channel]}
            maxLength={400}
            onChange={(event) => setDestination(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {REPORT_EVENTS.map((event) => (
          <label key={event} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={events.includes(event)}
              onCheckedChange={() =>
                setEvents((prev) =>
                  prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
                )
              }
            />
            {EVENT_LABELS[event]}
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          Add channel
        </Button>
      </div>
    </div>
  );
}

function ChannelRow({ rule }: { rule: NotificationRule }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notification-rules"] });

  const toggle = useMutation({
    mutationFn: (active: boolean) =>
      saveNotificationRule(
        {
          name: rule.name,
          channel: rule.channel,
          destination: rule.destination,
          events: rule.events ?? [],
          recipientUserIds: rule.recipient_user_ids ?? [],
          active,
        },
        rule.id,
      ),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteNotificationRule(rule.id),
    onSuccess: () => {
      invalidate();
      toast.success("Channel removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const Icon = rule.channel === "email" ? Mail : Webhook;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/60 p-3.5">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Icon className="size-4 text-primary" />
          <span className="truncate">{rule.name}</span>
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {CHANNEL_LABELS[rule.channel]} · {rule.destination}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(rule.events ?? [])
          .filter((event) => REPORT_EVENTS.includes(event))
          .map((event) => (
            <Badge key={event} variant="outline">
              {EVENT_LABELS[event]}
            </Badge>
          ))}
        <Switch checked={rule.active} onCheckedChange={(next) => toggle.mutate(next)} />
        <Button size="icon" variant="ghost" onClick={() => remove.mutate()}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** Fires a sample completed/failed event and reports per-recipient status. */
function TestSend({ onResults }: { onResults: (r: SampleDeliveryResult[]) => void }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<NotificationEvent | null>(null);

  const run = async (type: NotificationEvent) => {
    setPending(type);
    try {
      const results = await sendTestNotification(type);
      onResults(results);
      await queryClient.invalidateQueries({ queryKey: ["notification-deliveries"] });
      const failed = results.filter((r) => r.status === "failed").length;
      if (results.length === 0) toast.info("No active channels matched this event");
      else if (failed) toast.error(`${failed} of ${results.length} test deliveries failed`);
      else toast.success(`Test sent to ${results.length} recipient(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test send failed");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {REPORT_EVENTS.map((event) => (
        <Button
          key={event}
          size="sm"
          variant="outline"
          disabled={pending !== null}
          onClick={() => void run(event)}
        >
          <Send className="mr-1 size-3.5" />
          {pending === event ? "Sending…" : `Test ${EVENT_LABELS[event].toLowerCase()}`}
        </Button>
      ))}
    </div>
  );
}

function CopilotNotifications() {
  const rules = useQuery(notificationRulesQuery);
  const deliveries = useQuery(notificationDeliveriesQuery);
  const [adding, setAdding] = useState(false);
  const [testResults, setTestResults] = useState<SampleDeliveryResult[] | null>(null);

  const reportRules = useMemo(() => (rules.data ?? []).filter(isReportRule), [rules.data]);
  const reportDeliveries = useMemo(
    () => (deliveries.data ?? []).filter((d) => d.event_type.startsWith("report.")).slice(0, 25),
    [deliveries.data],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Copilot report notifications"
        description="Decide who hears about a streamed executive report — email recipients and Slack, Teams or custom webhooks are notified the moment a run completes or fails."
      />

      <Panel
        title="Delivery channels"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TestSend onResults={setTestResults} />
            <Button size="sm" onClick={() => setAdding((v) => !v)}>
              <Plus className="mr-1 size-4" /> Add channel
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {adding && <ChannelForm onDone={() => setAdding(false)} />}
          {rules.isLoading ? (
            <LoadingState rows={3} />
          ) : rules.isError ? (
            <ErrorState
              message={
                rules.error instanceof Error ? rules.error.message : "Could not load channels."
              }
              onRetry={() => void rules.refetch()}
            />
          ) : reportRules.length === 0 ? (
            <EmptyState
              title="No report channels yet"
              description="Add an email recipient or a Slack/Teams webhook to be told when an executive report finishes."
            />
          ) : (
            reportRules.map((rule) => <ChannelRow key={rule.id} rule={rule} />)
          )}

          {testResults && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last test send
              </p>
              {testResults.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No active channel is subscribed to that event yet.
                </p>
              ) : (
                testResults.map((result) => (
                  <div
                    key={`${result.channel}-${result.destination}`}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-foreground">{result.destination}</span>
                    <span className="flex items-center gap-2">
                      {result.attempts && result.attempts > 1 && (
                        <span className="text-muted-foreground">
                          {result.attempts} attempts
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          result.status === "sent" ? "text-success" : "text-destructive"
                        }
                      >
                        {result.status}
                        {result.error ? ` · ${result.error}` : ""}
                      </Badge>
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Recent report notifications">
        {deliveries.isLoading ? (
          <LoadingState rows={3} />
        ) : reportDeliveries.length === 0 ? (
          <EmptyState
            title="Nothing delivered yet"
            description="Outcomes appear here once a report run notifies one of your channels."
          />
        ) : (
          <div className="space-y-2">
            {reportDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
              >
                <span className="flex items-center gap-1.5 text-foreground">
                  <BellRing className="size-3.5 text-muted-foreground" />
                  {EVENT_LABELS[delivery.event_type as NotificationEvent] ?? delivery.event_type}
                </span>
                <span className="truncate text-muted-foreground">{delivery.destination}</span>
                <Badge
                  variant="outline"
                  className={
                    delivery.status === "sent"
                      ? "text-success"
                      : delivery.status === "failed"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {delivery.status}
                </Badge>
                {delivery.attempt > 1 && (
                  <span className="text-muted-foreground">attempt {delivery.attempt}</span>
                )}
                <span className="text-muted-foreground">{formatDateTime(delivery.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
