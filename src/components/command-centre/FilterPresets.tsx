import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Check,
  Copy,
  Loader2,
  Plus,
  Settings2,
  Share2,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  activeFilterCount,
  rangeLabel,
  type CommandFilters,
} from "@/features/command-centre/filters";
import {
  createFilterPreset,
  deleteFilterPreset,
  filterPresetsQuery,
  presetShareUrl,
  presetToFilters,
  scopeLabel,
  updateFilterPreset,
  type FilterPreset,
} from "@/features/command-centre/presets";


/**
 * Saved filter presets: capture the current global filter set under a name and
 * re-apply or share it with the workspace in one click.
 */
export function FilterPresets({
  filters,
  onApply,
}: {
  filters: CommandFilters;
  onApply: (filters: CommandFilters) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(true);

  const presets = useQuery(filterPresetsQuery);
  const rows = presets.data ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: filterPresetsQuery.queryKey });

  const save = useMutation({
    mutationFn: () => createFilterPreset({ name: name.trim(), filters, is_shared: shared }),
    onSuccess: async () => {
      await refresh();
      setName("");
      toast.success("Filter preset saved");
    },
    onError: (error: Error) => toast.error("Could not save preset", { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: (preset: FilterPreset) => deleteFilterPreset(preset.id),
    onSuccess: async () => {
      await refresh();
      toast.success("Preset deleted");
    },
    onError: (error: Error) => toast.error("Could not delete", { description: error.message }),
  });

  const share = useMutation({
    mutationFn: (preset: FilterPreset) =>
      updateFilterPreset(preset.id, { is_shared: !preset.is_shared }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error("Could not update", { description: error.message }),
  });

  const apply = (preset: FilterPreset) => {
    onApply(presetToFilters(preset));
    setOpen(false);
    toast.success(`Applied "${preset.name}"`);
  };

  const copyLink = async (preset: FilterPreset) => {
    try {
      await navigator.clipboard.writeText(presetShareUrl(preset));
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 border-border bg-surface/60 text-xs font-medium"
        >
          <Bookmark className="size-3.5" />
          Presets
          {rows.length > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 text-[10px] tabular-nums text-primary">
              {rows.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b border-border p-3">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Save current view
          </Label>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {rangeLabel(filters)} · {activeFilterCount(filters)} filter
            {activeFilterCount(filters) === 1 ? "" : "s"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Weekly leadership view"
              className="h-8 text-xs"
            />
            <Button
              size="icon"
              className="size-8 shrink-0"
              disabled={!name.trim() || save.isPending}
              onClick={() => save.mutate()}
              aria-label="Save preset"
            >
              {save.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
            </Button>
          </div>
          <label className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            Share with the workspace
            <Switch checked={shared} onCheckedChange={setShared} />
          </label>
        </div>

        <ScrollArea className="max-h-72">
          <div className="p-2">
            {presets.isLoading && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                Loading presets…
              </p>
            )}
            {!presets.isLoading && rows.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No saved presets yet.
              </p>
            )}
            {rows.map((preset) => (
              <div
                key={preset.id}
                className="group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-accent"
              >
                <button
                  type="button"
                  onClick={() => apply(preset)}
                  className="flex min-w-0 flex-1 flex-col items-start px-1.5 py-1 text-left"
                >
                  <span className="flex w-full items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{preset.name}</span>
                    {preset.is_shared && (
                      <Badge variant="outline" className="gap-1 text-[9px]">
                        <Users className="size-2.5" />
                        Shared
                      </Badge>
                    )}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {rangeLabel(presetToFilters(preset))} ·{" "}
                    {activeFilterCount(presetToFilters(preset))} filters
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => share.mutate(preset)}
                  aria-label={preset.is_shared ? "Make private" : "Share preset"}
                >
                  {preset.is_shared ? (
                    <Check className="size-3.5 text-primary" />
                  ) : (
                    <Share2 className="size-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => void copyLink(preset)}
                  aria-label="Copy share link"
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(preset)}
                  aria-label={`Delete ${preset.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
