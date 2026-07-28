import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw, Save } from "lucide-react";

import { ErrorState, LoadingState, Panel } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SECTION_DEFAULTS,
  saveSettings,
  settingsQuery,
  type SettingsDoc,
  type SettingsSection,
} from "@/features/administration/queries";

export interface SettingsField {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "switch" | "select" | "slider" | "date";
  hint?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  full?: boolean;
}

export interface SettingsGroup {
  title: string;
  description?: string;
  fields: SettingsField[];
}

/**
 * Renders one administration section against its JSONB settings document.
 * Keeping the form declarative means every screen behaves identically:
 * same dirty-state handling, same save/reset affordances, same audit trail.
 */
export function SettingsForm({
  section,
  groups,
}: {
  section: SettingsSection;
  groups: SettingsGroup[];
}) {
  const { data, isPending, error, refetch } = useQuery(settingsQuery(section));
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsDoc>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings(section, form),
    onSuccess: () => {
      toast.success("Configuration saved");
      queryClient.invalidateQueries({ queryKey: ["admin-settings", section] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Panel key={group.title} title={group.title} description={group.description}>
          {isPending ? (
            <LoadingState rows={4} />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {group.fields.map((field) => (
                <div
                  key={field.key}
                  className={field.full || field.type === "textarea" ? "md:col-span-2" : undefined}
                >
                  <FieldControl field={field} value={form[field.key]} onChange={set} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending || isPending}>
          <Save className="mr-2 size-4" /> Save changes
        </Button>
        <Button
          variant="outline"
          onClick={() => setForm({ ...SECTION_DEFAULTS[section] })}
          disabled={isPending}
        >
          <RotateCcw className="mr-2 size-4" /> Restore defaults
        </Button>
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: SettingsField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  if (field.type === "switch") {
    return (
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{field.label}</p>
          {field.hint && <p className="mt-0.5 text-xs text-muted-foreground">{field.hint}</p>}
        </div>
        <Switch
          aria-label={field.label}
          checked={Boolean(value)}
          onCheckedChange={(v) => onChange(field.key, v)}
        />
      </div>
    );
  }

  if (field.type === "slider") {
    const numeric = Number(value ?? field.min ?? 0);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={field.key}>{field.label}</Label>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{numeric}</span>
        </div>
        <Slider
          id={field.key}
          value={[numeric]}
          min={field.min ?? 0}
          max={field.max ?? 1}
          step={field.step ?? 0.05}
          onValueChange={([v]) => onChange(field.key, v)}
        />
        {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-2">
        <Label>{field.label}</Label>
        <Select value={String(value ?? "")} onValueChange={(v) => onChange(field.key, v)}>
          <SelectTrigger className="bg-surface">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.key}>{field.label}</Label>
        <Textarea
          id={field.key}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          maxLength={4000}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="min-h-24 bg-surface"
        />
        {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={field.key}>{field.label}</Label>
      <Input
        id={field.key}
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        min={field.min}
        max={field.max}
        step={field.step}
        maxLength={field.type === "text" ? 255 : undefined}
        onChange={(e) =>
          onChange(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)
        }
        className="bg-surface"
      />
      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
    </div>
  );
}
