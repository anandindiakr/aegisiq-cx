/**
 * Recipient groups panel for the copilot notifications settings page.
 *
 * Groups exist so an executive can manage bulk recipients once — a Teams
 * channel plus the CXO email list, for example — subscribe them to report
 * events as a unit, and pin a delivery schedule so nothing fires at 3am.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Moon, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Panel } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHANNEL_LABELS,
  EVENT_GROUPS,
  EVENT_LABELS,
  type NotificationChannel,
  type NotificationEvent,
} from "@/features/command-centre/notificationEvents";
import {
  DAY_LABELS,
  EMPTY_GROUP,
  GROUP_TIMEZONES,
  deleteNotificationGroup,
  describeSchedule,
  isWithinWindow,
  notificationGroupsQuery,
  saveNotificationGroup,
  toGroupInput,
  type GroupMember,
  type NotificationGroup,
  type NotificationGroupInput,
} from "@/features/command-centre/notificationGroups";

const HOURS = Array.from({ length: 25 }, (_, i) => i);

export function RecipientGroupsPanel() {
  const queryClient = useQueryClient();
  const groups = useQuery(notificationGroupsQuery);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NotificationGroupInput | null>(null);

  const save = useMutation({
    mutationFn: () => saveNotificationGroup(draft!, editingId ?? undefined),
    onSuccess: () => {
      toast.success(editingId ? "Recipient group updated" : "Recipient group created");
      setDraft(null);
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["notification-groups"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNotificationGroup(id),
    onSuccess: () => {
      toast.success("Recipient group removed");
      void queryClient.invalidateQueries({ queryKey: ["notification-groups"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startNew = () => {
    setEditingId(null);
    setDraft({ ...EMPTY_GROUP, members: [] });
  };

  const startEdit = (group: NotificationGroup) => {
    setEditingId(group.id);
    setDraft(toGroupInput(group));
  };

  const patch = (partial: Partial<NotificationGroupInput>) =>
    setDraft((current) => (current ? { ...current, ...partial } : current));

  const updateMember = (index: number, partial: Partial<GroupMember>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            members: current.members.map((member, i) =>
              i === index ? { ...member, ...partial } : member,
            ),
          }
        : current,
    );

  const toggleEvent = (event: NotificationEvent) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            events: current.events.includes(event)
              ? current.events.filter((item) => item !== event)
              : [...current.events, event],
          }
        : current,
    );

  const toggleDay = (day: number) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            window_days: current.window_days.includes(day)
              ? current.window_days.filter((item) => item !== day)
              : [...current.window_days, day],
          }
        : current,
    );

  return (
    <Panel
      title="Recipient groups"
      description="Bundle channels and email lists, subscribe them per report type, and control when they may be paged."
      actions={
        <Button size="sm" variant="outline" onClick={startNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New group
        </Button>
      }
    >
      <div className="space-y-4">
        {groups.data?.length === 0 && !draft ? (
          <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No recipient groups yet. Create one to notify a whole distribution list at once.
          </p>
        ) : null}

        {(groups.data ?? []).map((group) => {
          const onDuty = isWithinWindow(group);
          return (
            <div
              key={group.id}
              className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{group.name}</span>
                <Badge variant={group.active ? "default" : "outline"} className="text-[10px]">
                  {group.active ? "Active" : "Paused"}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${onDuty ? "text-emerald-400" : "text-muted-foreground"}`}
                >
                  {onDuty ? "In delivery window" : "Outside window"}
                </Badge>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(group)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove.mutate(group.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {(group.members ?? []).length} recipients ·{" "}
                {(group.events ?? []).length} event types
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {describeSchedule(group)}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(group.members ?? []).slice(0, 6).map((member, index) => (
                  <Badge key={`${member.destination}-${index}`} variant="secondary" className="text-[10px]">
                    {CHANNEL_LABELS[member.channel]} · {member.label || member.destination}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}

        {draft ? (
          <div className="space-y-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Group name</Label>
                <Input
                  value={draft.name}
                  placeholder="Executive distribution"
                  onChange={(event) => patch({ name: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={draft.description ?? ""}
                  placeholder="CXO email list + Ops Teams channel"
                  onChange={(event) => patch({ description: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Recipients</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch({
                      members: [...draft.members, { channel: "email", destination: "", label: "" }],
                    })
                  }
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add recipient
                </Button>
              </div>
              {draft.members.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add at least one email address or webhook URL.
                </p>
              ) : null}
              {draft.members.map((member, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[170px_1fr_150px_auto]">
                  <Select
                    value={member.channel}
                    onValueChange={(value) =>
                      updateMember(index, { channel: value as NotificationChannel })
                    }
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
                  <Input
                    value={member.destination}
                    placeholder={
                      member.channel === "email" ? "person@company.com" : "https://hooks..."
                    }
                    onChange={(event) => updateMember(index, { destination: event.target.value })}
                  />
                  <Input
                    value={member.label ?? ""}
                    placeholder="Label"
                    onChange={(event) => updateMember(index, { label: event.target.value })}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() =>
                      patch({ members: draft.members.filter((_, i) => i !== index) })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Report types</Label>
              <div className="space-y-2">
                {EVENT_GROUPS.map((section) => (
                  <div key={section.label} className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {section.label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {section.events.map((event) => {
                        const on = draft.events.includes(event);
                        return (
                          <button
                            key={event}
                            type="button"
                            onClick={() => toggleEvent(event)}
                            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                              on
                                ? "border-primary/60 bg-primary/15 text-primary"
                                : "border-border/60 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {EVENT_LABELS[event]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5" /> Delivery schedule
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Timezone</Label>
                  <Select value={draft.timezone} onValueChange={(value) => patch({ timezone: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUP_TIMEZONES.map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          {zone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Delivery days</Label>
                  <div className="flex flex-wrap gap-1">
                    {DAY_LABELS.map((label, day) => {
                      const on = draft.window_days.includes(day);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`rounded-md border px-2 py-1 text-[11px] ${
                            on
                              ? "border-primary/60 bg-primary/15 text-primary"
                              : "border-border/60 text-muted-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <HourSelect
                  label="Window opens"
                  value={draft.send_window_start}
                  onChange={(value) => patch({ send_window_start: value ?? 0 })}
                />
                <HourSelect
                  label="Window closes"
                  value={draft.send_window_end}
                  onChange={(value) => patch({ send_window_end: value ?? 24 })}
                />
                <HourSelect
                  label="Quiet from"
                  value={draft.quiet_hours_start}
                  nullable
                  onChange={(value) => patch({ quiet_hours_start: value })}
                />
                <HourSelect
                  label="Quiet until"
                  value={draft.quiet_hours_end}
                  nullable
                  onChange={(value) => patch({ quiet_hours_end: value })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm">Always deliver failures</p>
                  <p className="text-xs text-muted-foreground">
                    Failed reports bypass quiet hours so incidents are never silenced.
                  </p>
                </div>
                <Switch
                  checked={draft.bypass_quiet_for_failures}
                  onCheckedChange={(checked) => patch({ bypass_quiet_for_failures: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <p className="text-sm">Group active</p>
                <Switch
                  checked={draft.active}
                  onCheckedChange={(checked) => patch({ active: checked })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!draft.name.trim() || draft.members.length === 0 || save.isPending}
                onClick={() => save.mutate()}
              >
                {editingId ? "Save group" : "Create group"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function HourSelect({
  label,
  value,
  onChange,
  nullable,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  nullable?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={value === null ? "none" : String(value)}
        onValueChange={(next) => onChange(next === "none" ? null : Number(next))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {nullable ? <SelectItem value="none">Off</SelectItem> : null}
          {HOURS.map((hour) => (
            <SelectItem key={hour} value={String(hour)}>
              {String(hour).padStart(2, "0")}:00
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
