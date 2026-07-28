import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Loader2, Plus, Star, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, LoadingState, PageHeader, Panel } from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  activeFilterCount,
  defaultFilters,
  rangeLabel,
  type CommandFilters,
} from "@/features/command-centre/filters";
import {
  PRESET_SCOPES,
  createFilterPreset,
  deleteFilterPreset,
  filterPresetsQuery,
  presetShareUrl,
  presetToFilters,
  scopeLabel,
  setDefaultPreset,
  updateFilterPreset,
  type FilterPreset,
  type PresetScope,
} from "@/features/command-centre/presets";
import { Checkbox } from "@/components/ui/checkbox";
import { PresetBulkBar } from "@/components/command-centre/PresetBulkBar";
import { PresetShareDialog } from "@/components/command-centre/PresetShareDialog";
import { outletsQuery, type AppRole } from "@/features/platform/queries";
import { ASSIGNABLE_ROLES } from "@/features/platform/roles";

export const Route = createFileRoute("/_authenticated/filter-presets")({
  head: () => ({
    meta: [
      { title: "Filter Presets — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Create, edit, share and set default Command Centre filter presets for each role group or outlet across your workspace.",
      },
      { property: "og:title", content: "Filter Presets — AegisIQ CX™" },
      {
        property: "og:description",
        content:
          "Standardise how leadership reads the Command Centre with shared and default filter presets per role group or outlet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FilterPresetsPage,
});

function FilterPresetsPage() {
  const queryClient = useQueryClient();
  const presets = useQuery(filterPresetsQuery);
  const outlets = useQuery(outletsQuery);
  const rows = presets.data ?? [];

  const outletNames = useMemo(
    () => new Map((outlets.data ?? []).map((o) => [o.id, o.name])),
    [outlets.data],
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<PresetScope>("role");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [outletId, setOutletId] = useState<string>("");
  const [shared, setShared] = useState(true);
  const [makeDefault, setMakeDefault] = useState(false);
  const [filters] = useState<CommandFilters>(() => defaultFilters());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [shareFor, setShareFor] = useState<FilterPreset | null>(null);
  const selected = rows.filter((preset) => selectedIds.includes(preset.id));
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const refresh = () => queryClient.invalidateQueries({ queryKey: filterPresetsQuery.queryKey });

  const create = useMutation({
    mutationFn: () =>
      createFilterPreset({
        name: name.trim(),
        description: description.trim() || null,
        filters,
        is_shared: shared,
        is_default: makeDefault,
        scope,
        scope_roles: scope === "role" ? roles : [],
        outlet_id: scope === "outlet" ? outletId || null : null,
      }),
    onSuccess: async () => {
      await refresh();
      setName("");
      setDescription("");
      setRoles([]);
      setMakeDefault(false);
      toast.success("Preset created");
    },
    onError: (error: Error) =>
      toast.error("Could not create preset", { description: error.message }),
  });

  const patch = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof updateFilterPreset>[1];
    }) => updateFilterPreset(id, values),
    onSuccess: refresh,
    onError: (error: Error) => toast.error("Could not update", { description: error.message }),
  });

  const makeDefaultFor = useMutation({
    mutationFn: (preset: FilterPreset) => setDefaultPreset(preset, rows),
    onSuccess: async () => {
      await refresh();
      toast.success("Default preset updated");
    },
    onError: (error: Error) => toast.error("Could not set default", { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: (preset: FilterPreset) => deleteFilterPreset(preset.id),
    onSuccess: async () => {
      await refresh();
      toast.success("Preset deleted");
    },
    onError: (error: Error) => toast.error("Could not delete", { description: error.message }),
  });

  const copyLink = async (preset: FilterPreset) => {
    try {
      await navigator.clipboard.writeText(presetShareUrl(preset));
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  const toggleRole = (role: AppRole) =>
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  const grouped = useMemo(
    () => ({
      role: rows.filter((p) => p.scope === "role"),
      outlet: rows.filter((p) => p.scope === "outlet"),
      personal: rows.filter((p) => p.scope === "personal"),
    }),
    [rows],
  );

  const renderPreset = (preset: FilterPreset) => {
    const resolved = presetToFilters(preset);
    return (
      <div
        key={preset.id}
        className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-surface/40 p-3"
      >
        <Checkbox
          checked={selectedIds.includes(preset.id)}
          onCheckedChange={() => toggleSelected(preset.id)}
          aria-label={`Select ${preset.name}`}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-medium">
            {preset.name}
            {preset.is_default && (
              <Badge variant="outline" className="gap-1 text-[9px] text-primary">
                <Star className="size-2.5" />
                Default
              </Badge>
            )}
            {preset.is_shared && (
              <Badge variant="outline" className="gap-1 text-[9px]">
                <Users className="size-2.5" />
                Shared
              </Badge>
            )}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {scopeLabel(preset, preset.outlet_id ? outletNames.get(preset.outlet_id) : undefined)} ·{" "}
            {rangeLabel(resolved)} · {activeFilterCount(resolved)} filters
          </p>
          {preset.description && (
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{preset.description}</p>
          )}
        </div>

        <Input
          defaultValue={preset.name}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value && value !== preset.name) {
              patch.mutate({ id: preset.id, values: { name: value } });
            }
          }}
          className="h-8 w-48 text-xs"
          aria-label={`Rename ${preset.name}`}
        />

        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Shared
          <Switch
            checked={preset.is_shared}
            onCheckedChange={(checked) =>
              patch.mutate({ id: preset.id, values: { is_shared: checked } })
            }
            aria-label={`Share ${preset.name}`}
          />
        </label>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={preset.is_default || makeDefaultFor.isPending}
          onClick={() => makeDefaultFor.mutate(preset)}
          aria-label={`Set ${preset.name} as default`}
        >
          <Star className={preset.is_default ? "size-4 text-primary" : "size-4"} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => void copyLink(preset)}
          aria-label={`Copy link to ${preset.name}`}
        >
          <Copy className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setShareFor(preset)}
          aria-label={`Create a share link for ${preset.name}`}
          title="Expiring share link"
        >
          <Link2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          onClick={() => remove.mutate(preset)}
          aria-label={`Delete ${preset.name}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Filter presets"
        description="Create, share and set default Command Centre views for each role group or outlet."
      />

      <Panel
        title="New preset"
        description="The preset captures the standard Command Centre view; refine the filters on the dashboard and re-save at any time."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Regional managers — daily"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Applies to</Label>
            <Select value={scope} onValueChange={(value) => setScope(value as PresetScope)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESET_SCOPES.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-sm">
                    {option.label} — {option.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {scope === "role" && (
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs">Role group</Label>
              <div className="flex flex-wrap gap-2">
                {ASSIGNABLE_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={
                      roles.includes(role)
                        ? "rounded-full border border-primary/50 bg-primary/15 px-3 py-1 text-[11px] capitalize text-primary"
                        : "rounded-full border border-border px-3 py-1 text-[11px] capitalize text-muted-foreground hover:border-primary/40"
                    }
                  >
                    {role.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {scope === "outlet" && (
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs">Outlet</Label>
              <Select value={outletId} onValueChange={setOutletId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose an outlet" />
                </SelectTrigger>
                <SelectContent>
                  {(outlets.data ?? []).map((outlet) => (
                    <SelectItem key={outlet.id} value={outlet.id} className="text-sm">
                      {outlet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="What this view is for and who should use it."
            />
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs">
            Share with the workspace
            <Switch checked={shared} onCheckedChange={setShared} />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs">
            Make this the default for its audience
            <Switch checked={makeDefault} onCheckedChange={setMakeDefault} />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            {rangeLabel(filters)} · {activeFilterCount(filters)} filters captured
          </p>
          <Button
            disabled={
              !name.trim() ||
              create.isPending ||
              (scope === "role" && roles.length === 0) ||
              (scope === "outlet" && !outletId)
            }
            onClick={() => create.mutate()}
            className="gap-2"
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Create preset
          </Button>
        </div>
      </Panel>

      {presets.isLoading && <LoadingState rows={4} />}

      {!presets.isLoading && rows.length === 0 && (
        <EmptyState
          title="No presets yet"
          description="Create your first preset above to standardise how your leadership team reads the Command Centre."
        />
      )}

      {selected.length > 0 && (
        <PresetBulkBar
          selected={selected}
          outlets={(outlets.data ?? []).map((o) => ({ id: o.id, name: o.name }))}
          onDone={() => setSelectedIds([])}
        />
      )}

      <PresetShareDialog preset={shareFor} onOpenChange={(open) => !open && setShareFor(null)} />

      {(["role", "outlet", "personal"] as const).map((key) =>
        grouped[key].length > 0 ? (
          <Panel
            key={key}
            title={
              key === "role"
                ? "Role group presets"
                : key === "outlet"
                  ? "Outlet presets"
                  : "Personal and shared presets"
            }
            description={PRESET_SCOPES.find((s) => s.value === key)?.hint}
          >
            <div className="space-y-2">{grouped[key].map(renderPreset)}</div>
          </Panel>
        ) : null,
      )}
    </div>
  );
}
