import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Panel } from "@/components/common/Primitives";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PREFERENCES,
  SLA_FREQUENCIES,
  notificationPreferencesQuery,
  saveNotificationPreferences,
  type NotificationPreferences,
  type SlaFrequency,
} from "@/features/conversationiq/notifications";

const TOGGLES: { key: keyof NotificationPreferences; label: string; hint: string }[] = [
  {
    key: "in_app_alerts",
    label: "In-app alert notifications",
    hint: "Toast when a new alert is raised for your workspace.",
  },
  {
    key: "email_alerts",
    label: "Email alert notifications",
    hint: "Include new alerts in your escalation email digest.",
  },
  {
    key: "sla_in_app",
    label: "In-app SLA escalations",
    hint: "Warn when reviewer queue items approach or cross their SLA.",
  },
  {
    key: "sla_email",
    label: "Email SLA escalations",
    hint: "Allow breach digests to be sent by email from the reviewer queue.",
  },
];

/** Per-user control over which notifications this reviewer receives. */
export function NotificationSettings() {
  const queryClient = useQueryClient();
  const prefsQuery = useQuery(notificationPreferencesQuery);
  const prefs = prefsQuery.data ?? DEFAULT_PREFERENCES;

  const save = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) => saveNotificationPreferences(patch),
    onSuccess: () => {
      toast.success("Notification settings saved");
      void queryClient.invalidateQueries({ queryKey: ["iq", "notification-preferences"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Panel
      title="Notification settings"
      description="Choose which alerts and SLA escalations reach you, and how often reminders may repeat."
    >
      {prefsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your settings…</p>
      ) : (
        <div className="space-y-4">
          {TOGGLES.map((toggle) => (
            <div key={toggle.key} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor={toggle.key} className="text-sm">
                  {toggle.label}
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{toggle.hint}</p>
              </div>
              <Switch
                id={toggle.key}
                checked={Boolean(prefs[toggle.key])}
                disabled={save.isPending}
                onCheckedChange={(checked) => save.mutate({ [toggle.key]: checked })}
              />
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div>
              <Label className="flex items-center gap-2 text-sm">
                <BellRing className="size-3.5" /> SLA escalation frequency
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {SLA_FREQUENCIES.find((f) => f.value === prefs.sla_frequency)?.hint}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {save.isPending && <Loader2 className="size-4 animate-spin text-primary" />}
              <Select
                value={prefs.sla_frequency}
                disabled={save.isPending}
                onValueChange={(value) => save.mutate({ sla_frequency: value as SlaFrequency })}
              >
                <SelectTrigger className="h-9 w-44 bg-surface text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLA_FREQUENCIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
