import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Send, Trash2, Copy, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { staffQuery } from "@/features/platform/queries";
import {
  CHANNEL_LABELS,
  EVENT_GROUPS,
  EVENT_LABELS,
  type NotificationChannel,
  type NotificationEvent,
} from "@/features/command-centre/notificationEvents";
import {
  deleteNotificationRule,
  deleteWebhookEndpoint,
  generateWebhookSecret,
  notificationDeliveriesQuery,
  notificationRulesQuery,
  saveNotificationRule,
  saveWebhookEndpoint,
  webhookEndpointsQuery,
  type NotificationRule,
  type WebhookEndpoint,
} from "@/features/command-centre/notificationChannels";
import { sendTestWebhook } from "@/lib/notifications.functions";
import { getActiveTenant } from "@/features/platform/queries";

function EventPicker({
  value,
  onChange,
}: {
  value: NotificationEvent[];
  onChange: (next: NotificationEvent[]) => void;
}) {
  const toggle = (event: NotificationEvent) =>
    onChange(value.includes(event) ? value.filter((e) => e !== event) : [...value, event]);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {EVENT_GROUPS.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          {group.events.map((event) => (
            <label key={event} className="flex items-center gap-2 text-sm">
              <Checkbox checked={value.includes(event)} onCheckedChange={() => toggle(event)} />
              {EVENT_LABELS[event]}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

const EMPTY_RULE = {
  name: "",
  channel: "email" as NotificationChannel,
  destination: "",
  events: [] as NotificationEvent[],
  recipientUserIds: [] as string[],
  active: true,
};

function RuleEditor({ existing, onDone }: { existing?: NotificationRule; onDone: () => void }) {
  const [draft, setDraft] = useState(
    existing
      ? {
          name: existing.name,
          channel: existing.channel,
          destination: existing.destination,
          events: existing.events ?? [],
          recipientUserIds: existing.recipient_user_ids ?? [],
          active: existing.active,
        }
      : EMPTY_RULE,
  );
  const staff = useQuery(staffQuery);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () => saveNotificationRule(draft, existing?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-rules"] });
      toast.success(existing ? "Notification rule updated" : "Notification rule created");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const isEmail = draft.channel === "email";
  const people = (staff.data ?? []).filter((p) => p.user_id);

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            value={draft.name}
            placeholder="Ops team — export failures"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select
            value={draft.channel}
            onValueChange={(v) => setDraft({ ...draft, channel: v as NotificationChannel })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{isEmail ? "Fallback email address (optional)" : "Webhook URL"}</Label>
        <Input
          value={draft.destination}
          placeholder={isEmail ? "ops@company.com" : "https://hooks.slack.com/services/…"}
          onChange={(e) => setDraft({ ...draft, destination: e.target.value })}
        />
      </div>

      {isEmail && (
        <div className="space-y-1.5">
          <Label>Notify these users</Label>
          <ScrollArea className="h-40 rounded-md border border-border/60 p-2">
            {people.map((person) => {
              const checked = draft.recipientUserIds.includes(person.user_id!);
              return (
                <label key={person.id} className="flex items-center gap-2 py-1 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() =>
                      setDraft({
                        ...draft,
                        recipientUserIds: checked
                          ? draft.recipientUserIds.filter((id) => id !== person.user_id)
                          : [...draft.recipientUserIds, person.user_id!],
                      })
                    }
                  />
                  <span>{person.full_name}</span>
                  <span className="text-xs text-muted-foreground">{person.email}</span>
                </label>
              );
            })}
            {people.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">No users in this workspace yet.</p>
            )}
          </ScrollArea>
        </div>
      )}

      <div className="space-y-2">
        <Label>Events</Label>
        <EventPicker value={draft.events} onChange={(events) => setDraft({ ...draft, events })} />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.active}
            onCheckedChange={(active) => setDraft({ ...draft, active })}
          />
          Active
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button
            disabled={!draft.name || draft.events.length === 0 || save.isPending}
            onClick={() => save.mutate()}
          >
            Save rule
          </Button>
        </div>
      </div>
    </div>
  );
}

function EndpointEditor({ existing, onDone }: { existing?: WebhookEndpoint; onDone: () => void }) {
  const [draft, setDraft] = useState(
    existing
      ? {
          name: existing.name,
          url: existing.url,
          secret: existing.secret,
          events: existing.events ?? [],
          description: existing.description ?? "",
          active: existing.active,
        }
      : {
          name: "",
          url: "",
          secret: generateWebhookSecret(),
          events: [] as NotificationEvent[],
          description: "",
          active: true,
        },
  );
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () =>
      saveWebhookEndpoint({ ...draft, description: draft.description || null }, existing?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-endpoints"] });
      toast.success(existing ? "Endpoint updated" : "Endpoint created");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const test = useMutation({
    mutationFn: async () => {
      const companyId = getActiveTenant();
      if (!companyId) throw new Error("No active workspace.");
      return sendTestWebhook({ data: { companyId, url: draft.url, secret: draft.secret } });
    },
    onSuccess: (result) =>
      result.ok
        ? toast.success(`Endpoint responded ${result.status}`)
        : toast.error(`Test failed (${result.status || "no response"})`),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            value={draft.name}
            placeholder="Compliance backend"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Callback URL</Label>
          <Input
            value={draft.url}
            placeholder="https://api.company.com/aegisiq/webhooks"
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Signing secret</Label>
        <div className="flex gap-2">
          <Input readOnly value={draft.secret} className="font-mono text-xs" />
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(draft.secret);
              toast.success("Secret copied");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDraft({ ...draft, secret: generateWebhookSecret() })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Every callback carries{" "}
          <code className="font-mono">x-aegisiq-signature: t=&lt;unix&gt;,v1=&lt;hmac&gt;</code> —
          an HMAC-SHA256 of{" "}
          <code className="font-mono">
            `${"{t}"}.${"{raw body}"}`
          </code>{" "}
          using this secret. Compare it in constant time and reject timestamps older than five
          minutes.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Events</Label>
        <EventPicker value={draft.events} onChange={(events) => setDraft({ ...draft, events })} />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.active}
            onCheckedChange={(active) => setDraft({ ...draft, active })}
          />
          Active
        </label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!draft.url || test.isPending}
            onClick={() => test.mutate()}
          >
            <Send className="mr-2 h-4 w-4" /> Send test
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button
            disabled={!draft.name || !draft.url || draft.events.length === 0 || save.isPending}
            onClick={() => save.mutate()}
          >
            Save endpoint
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const rules = useQuery(notificationRulesQuery);
  const endpoints = useQuery(webhookEndpointsQuery);
  const deliveries = useQuery({ ...notificationDeliveriesQuery, refetchInterval: 30_000 });

  const [editingRule, setEditingRule] = useState<NotificationRule | "new" | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | "new" | null>(null);

  const removeRule = useMutation({
    mutationFn: deleteNotificationRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-rules"] });
      toast.success("Rule deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeEndpoint = useMutation({
    mutationFn: deleteWebhookEndpoint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-endpoints"] });
      toast.success("Endpoint deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const failureCount = useMemo(
    () => (deliveries.data ?? []).filter((d) => d.status === "failed").length,
    [deliveries.data],
  );

  return (
    <Tabs defaultValue="rules" className="space-y-4">
      <TabsList>
        <TabsTrigger value="rules">Notification rules</TabsTrigger>
        <TabsTrigger value="webhooks">Signed webhooks</TabsTrigger>
        <TabsTrigger value="history">
          Delivery history{failureCount ? ` (${failureCount} failed)` : ""}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="rules" className="space-y-3">
        {editingRule ? (
          <RuleEditor
            existing={editingRule === "new" ? undefined : editingRule}
            onDone={() => setEditingRule(null)}
          />
        ) : (
          <Button onClick={() => setEditingRule("new")}>
            <Plus className="mr-2 h-4 w-4" /> New rule
          </Button>
        )}
        <div className="space-y-2">
          {(rules.data ?? []).map((rule) => (
            <div
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{rule.name}</span>
                  <Badge variant="outline">{CHANNEL_LABELS[rule.channel]}</Badge>
                  {!rule.active && <Badge variant="secondary">Paused</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(rule.events ?? []).map((e) => EVENT_LABELS[e] ?? e).join(" · ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rule.channel === "email"
                    ? `${rule.recipient_user_ids?.length ?? 0} user(s)${rule.destination ? ` + ${rule.destination}` : ""}`
                    : rule.destination}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingRule(rule)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRule.mutate(rule.id)}
                  aria-label={`Delete ${rule.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {!rules.isLoading && (rules.data ?? []).length === 0 && !editingRule && (
            <p className="text-sm text-muted-foreground">
              No notification rules yet. Add one to alert specific people when exports finish or
              access requests change status.
            </p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="webhooks" className="space-y-3">
        {editingEndpoint ? (
          <EndpointEditor
            existing={editingEndpoint === "new" ? undefined : editingEndpoint}
            onDone={() => setEditingEndpoint(null)}
          />
        ) : (
          <Button onClick={() => setEditingEndpoint("new")}>
            <Plus className="mr-2 h-4 w-4" /> New endpoint
          </Button>
        )}
        <div className="space-y-2">
          {(endpoints.data ?? []).map((endpoint) => (
            <div
              key={endpoint.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{endpoint.name}</span>
                  {!endpoint.active && <Badge variant="secondary">Paused</Badge>}
                  {endpoint.last_status !== null && (
                    <Badge variant={endpoint.last_error ? "destructive" : "outline"}>
                      last {endpoint.last_status || "error"}
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-xs text-muted-foreground">{endpoint.url}</p>
                <p className="text-xs text-muted-foreground">
                  {(endpoint.events ?? []).map((e) => EVENT_LABELS[e] ?? e).join(" · ")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingEndpoint(endpoint)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEndpoint.mutate(endpoint.id)}
                  aria-label={`Delete ${endpoint.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {!endpoints.isLoading && (endpoints.data ?? []).length === 0 && !editingEndpoint && (
            <p className="text-sm text-muted-foreground">
              No signed endpoints yet. Add one so your backend receives a verifiable callback each
              time an export or scheduled delivery completes or fails.
            </p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="history">
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Event</th>
                <th className="p-2">Channel</th>
                <th className="p-2">Target</th>
                <th className="p-2">Status</th>
                <th className="p-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {(deliveries.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-border/50">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="p-2">
                    {EVENT_LABELS[row.event_type as NotificationEvent] ?? row.event_type}
                  </td>
                  <td className="p-2">{row.channel}</td>
                  <td className="p-2 max-w-[240px] truncate">
                    {row.target_label ?? row.destination}
                  </td>
                  <td className="p-2">
                    <Badge
                      variant={
                        row.status === "sent"
                          ? "outline"
                          : row.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {row.status}
                      {row.response_status ? ` ${row.response_status}` : ""}
                    </Badge>
                  </td>
                  <td className="p-2 max-w-[280px] truncate text-muted-foreground">
                    {row.error_message ?? "—"}
                  </td>
                </tr>
              ))}
              {(deliveries.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    No notification deliveries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
