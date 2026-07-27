import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  createReportSchedule,
  deleteReportSchedule,
  reportSchedulesQuery,
  updateReportSchedule,
  type ReportFormat,
  type ReportFrequency,
} from "@/features/command-centre/queries";

const FREQUENCIES: ReportFrequency[] = ["daily", "weekly", "monthly"];
const FORMATS: ReportFormat[] = ["pdf", "excel", "csv", "powerpoint"];

export function ScheduledReports() {
  const queryClient = useQueryClient();
  const { data: schedules = [], isLoading } = useQuery(reportSchedulesQuery);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Weekly executive briefing");
  const [frequency, setFrequency] = useState<ReportFrequency>("weekly");
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [recipients, setRecipients] = useState("");
  const [sendHour, setSendHour] = useState(8);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: reportSchedulesQuery.queryKey });

  const create = useMutation({
    mutationFn: () =>
      createReportSchedule({
        name,
        frequency,
        format,
        send_hour: sendHour,
        recipients: recipients
          .split(/[,;\s]+/)
          .map((r) => r.trim())
          .filter(Boolean),
      }),
    onSuccess: async () => {
      await invalidate();
      setOpen(false);
      setRecipients("");
      toast.success("Report scheduled");
    },
    onError: (error: Error) =>
      toast.error("Could not schedule report", { description: error.message }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateReportSchedule(id, { is_active }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteReportSchedule(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Schedule removed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarClock className="size-4" />
          Scheduled reports
          {schedules.length > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 text-[10px] tabular-nums text-primary">
              {schedules.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scheduled executive reports</DialogTitle>
          <DialogDescription>
            Automated distribution of the command centre briefing to your leadership team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline size-4 animate-spin" />
              Loading schedules…
            </p>
          )}
          {!isLoading && schedules.length === 0 && (
            <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No scheduled reports yet.
            </p>
          )}
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface/40 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{schedule.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {schedule.frequency} · {schedule.format.toUpperCase()} ·{" "}
                  {String(schedule.send_hour).padStart(2, "0")}:00 · {schedule.recipients.length}{" "}
                  recipient
                  {schedule.recipients.length === 1 ? "" : "s"}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {schedule.last_sent_at
                  ? `Sent ${new Date(schedule.last_sent_at).toLocaleDateString("en-GB")}`
                  : "Not sent yet"}
              </Badge>
              <Switch
                checked={schedule.is_active}
                onCheckedChange={(checked) =>
                  toggle.mutate({ id: schedule.id, is_active: checked })
                }
                aria-label="Toggle schedule"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => remove.mutate(schedule.id)}
                aria-label="Delete schedule"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border border-border/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            New schedule
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Recipients</Label>
              <Input
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="ceo@company.com, coo@company.com"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as ReportFrequency)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f} className="text-sm capitalize">
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as ReportFormat)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f} className="text-sm uppercase">
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Send hour</Label>
                <Select value={String(sendHour)} onValueChange={(v) => setSendHour(Number(v))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                      <SelectItem key={h} value={String(h)} className="text-sm">
                        {String(h).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-2"
            disabled={create.isPending || !name.trim()}
            onClick={() => create.mutate()}
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Create schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
