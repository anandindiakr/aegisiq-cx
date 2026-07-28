import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  dashboardLayoutQuery,
  saveDashboardLayout,
  type DashboardLayout,
} from "@/features/command-centre/queries";
import { WIDGETS, moveWidget, resolveOrder } from "@/features/command-centre/widgets";

const REFRESH_OPTIONS = [30, 60, 120, 300, 600];

export function DashboardSettings({ layout }: { layout: DashboardLayout }) {
  const queryClient = useQueryClient();
  const { isFetching } = useQuery(dashboardLayoutQuery);
  const [draft, setDraft] = useState<DashboardLayout>(layout);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) setDraft(layout);
  }, [layout, open]);

  const save = useMutation({
    mutationFn: (next: DashboardLayout) => saveDashboardLayout(next, layout),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dashboardLayoutQuery.queryKey });
      toast.success("Dashboard preferences saved");
      setOpen(false);
    },
    onError: (error: Error) =>
      toast.error("Could not save preferences", { description: error.message }),
  });

  const order = resolveOrder(draft.widget_order);
  const hidden = new Set(draft.hidden_widgets);
  const byId = new Map(WIDGETS.map((w) => [w.id, w]));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="size-4" />
          Dashboard settings
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle>Dashboard settings</SheetTitle>
          <SheetDescription>
            Reorder or hide widgets and control automatic refresh. Saved to your profile only.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="space-y-3 rounded-lg border border-border/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm">Auto refresh</Label>
                <p className="text-[11px] text-muted-foreground">
                  Keep the command centre live without reloading.
                </p>
              </div>
              <Switch
                checked={draft.auto_refresh}
                onCheckedChange={(checked) => setDraft({ ...draft, auto_refresh: checked })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Refresh interval</Label>
              <Select
                value={String(draft.refresh_interval_seconds)}
                onValueChange={(v) => setDraft({ ...draft, refresh_interval_seconds: Number(v) })}
                disabled={!draft.auto_refresh}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFRESH_OPTIONS.map((seconds) => (
                    <SelectItem key={seconds} value={String(seconds)} className="text-sm">
                      Every {seconds < 60 ? `${seconds} seconds` : `${seconds / 60} minutes`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Widgets
            </p>
            {order.map((id, index) => {
              const widget = byId.get(id);
              if (!widget) return null;
              const isHidden = hidden.has(id);
              return (
                <div
                  key={id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-border/70 bg-surface/40 p-2.5",
                    isHidden && "opacity-55",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{widget.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {widget.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={index === 0}
                    onClick={() => setDraft({ ...draft, widget_order: moveWidget(order, id, -1) })}
                    aria-label={`Move ${widget.label} up`}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={index === order.length - 1}
                    onClick={() => setDraft({ ...draft, widget_order: moveWidget(order, id, 1) })}
                    aria-label={`Move ${widget.label} down`}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        hidden_widgets: isHidden
                          ? draft.hidden_widgets.filter((w) => w !== id)
                          : [...draft.hidden_widgets, id],
                      })
                    }
                    aria-label={`${isHidden ? "Show" : "Hide"} ${widget.label}`}
                  >
                    {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setDraft({ ...draft, hidden_widgets: [], widget_order: resolveOrder([]) })
            }
          >
            Reset to default
          </Button>
          <Button
            size="sm"
            className="ml-auto gap-2"
            disabled={save.isPending || isFetching}
            onClick={() => save.mutate({ ...draft, widget_order: order })}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Save preferences
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
