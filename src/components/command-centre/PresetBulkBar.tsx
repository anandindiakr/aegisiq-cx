import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, PencilLine, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRESET_SCOPES,
  bulkDeletePresets,
  bulkRenamePresets,
  bulkRescopePresets,
  duplicateFilterPresets,
  filterPresetsQuery,
  type FilterPreset,
  type PresetScope,
} from "@/features/command-centre/presets";
import { ASSIGNABLE_ROLES } from "@/features/platform/roles";
import type { AppRole } from "@/features/platform/queries";

/**
 * Bulk actions for the presets screen. Duplicating across several outlets or a
 * role group is the fastest way to roll one agreed view out to a whole region
 * without re-entering the filters for each audience.
 */
export function PresetBulkBar({
  selected,
  outlets,
  onDone,
}: {
  selected: FilterPreset[];
  outlets: { id: string; name: string }[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [targetScope, setTargetScope] = useState<PresetScope>("role");
  const [targetRoles, setTargetRoles] = useState<AppRole[]>([]);
  const [targetOutlets, setTargetOutlets] = useState<string[]>([]);
  const [pattern, setPattern] = useState("{name}");

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: filterPresetsQuery.queryKey });
    onDone();
  };

  const duplicate = useMutation({
    mutationFn: () =>
      duplicateFilterPresets(selected, {
        scope: targetScope,
        scope_roles: targetScope === "role" ? targetRoles : [],
        outlet_ids: targetScope === "outlet" ? targetOutlets : [],
      }),
    onSuccess: async (count) => {
      await refresh();
      toast.success(`${count} preset${count === 1 ? "" : "s"} duplicated`);
    },
    onError: (error: Error) => toast.error("Could not duplicate", { description: error.message }),
  });

  const rename = useMutation({
    mutationFn: () => bulkRenamePresets(selected, pattern),
    onSuccess: async (count) => {
      await refresh();
      toast.success(count === 0 ? "Nothing to rename" : `${count} preset(s) renamed`);
    },
    onError: (error: Error) => toast.error("Could not rename", { description: error.message }),
  });

  const rescope = useMutation({
    mutationFn: () =>
      bulkRescopePresets(selected, targetScope, {
        scope_roles: targetRoles,
        outlet_id: targetOutlets[0] ?? null,
      }),
    onSuccess: async (count) => {
      await refresh();
      toast.success(`${count} preset(s) re-targeted`);
    },
    onError: (error: Error) => toast.error("Could not re-target", { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: () => bulkDeletePresets(selected),
    onSuccess: async (count) => {
      await refresh();
      toast.success(`${count} preset(s) deleted`);
    },
    onError: (error: Error) => toast.error("Could not delete", { description: error.message }),
  });

  const busy = duplicate.isPending || rename.isPending || rescope.isPending || remove.isPending;
  const toggleRole = (role: AppRole) =>
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  const toggleOutlet = (id: string) =>
    setTargetOutlets((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));

  return (
    <div className="sticky bottom-4 z-10 space-y-3 rounded-xl border border-primary/40 bg-surface/95 p-4 shadow-lg backdrop-blur">
      <p className="text-xs font-medium">
        {selected.length} preset{selected.length === 1 ? "" : "s"} selected
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Target audience</Label>
          <Select
            value={targetScope}
            onValueChange={(value) => setTargetScope(value as PresetScope)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_SCOPES.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-sm">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Rename pattern{" "}
            <span className="text-muted-foreground">
              — {"{name}"} and {"{n}"}
            </span>
          </Label>
          <Input
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            className="h-9 text-sm"
          />
        </div>

        {targetScope === "role" && (
          <div className="flex flex-wrap gap-2 lg:col-span-2">
            {ASSIGNABLE_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className={
                  targetRoles.includes(role)
                    ? "rounded-full border border-primary/50 bg-primary/15 px-3 py-1 text-[11px] capitalize text-primary"
                    : "rounded-full border border-border px-3 py-1 text-[11px] capitalize text-muted-foreground hover:border-primary/40"
                }
              >
                {role.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        )}

        {targetScope === "outlet" && (
          <div className="flex flex-wrap gap-2 lg:col-span-2">
            {outlets.map((outlet) => (
              <button
                key={outlet.id}
                type="button"
                onClick={() => toggleOutlet(outlet.id)}
                className={
                  targetOutlets.includes(outlet.id)
                    ? "rounded-full border border-primary/50 bg-primary/15 px-3 py-1 text-[11px] text-primary"
                    : "rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground hover:border-primary/40"
                }
              >
                {outlet.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="gap-2"
          disabled={busy || (targetScope === "outlet" && targetOutlets.length === 0)}
          onClick={() => duplicate.mutate()}
        >
          {duplicate.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Copy className="size-4" />
          )}
          Duplicate to audience
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={busy}
          onClick={() => rename.mutate()}
        >
          <PencilLine className="size-4" />
          Apply rename
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || (targetScope === "outlet" && targetOutlets.length === 0)}
          onClick={() => rescope.mutate()}
        >
          Move to audience
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2 text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => remove.mutate()}
        >
          <Trash2 className="size-4" />
          Delete selected
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onDone}>
          Clear selection
        </Button>
      </div>
    </div>
  );
}
