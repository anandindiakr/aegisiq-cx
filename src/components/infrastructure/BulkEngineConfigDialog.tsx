import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/common/Primitives";
import { bulkUpdateEngines, type AiEngine } from "@/features/infrastructure/queries";

/** Fields an operator may change across several engines at once. */
interface EngineDraft {
  enabled: string;
  region: string;
  version: string;
  endpoint: string;
  latency_ms: string;
}

const EMPTY: EngineDraft = {
  enabled: "unchanged",
  region: "",
  version: "",
  endpoint: "",
  latency_ms: "",
};

/** Turns the draft into a patch, or returns the first validation problem. */
export function buildEnginePatch(draft: EngineDraft): {
  patch: Partial<AiEngine>;
  error: string | null;
} {
  const patch: Partial<AiEngine> = {};
  if (draft.enabled !== "unchanged") patch.enabled = draft.enabled === "enabled";

  const region = draft.region.trim();
  if (region) {
    if (!/^[a-z0-9-]{2,32}$/i.test(region))
      return { patch, error: "Region must be 2–32 letters, numbers or hyphens (e.g. uae-north)." };
    patch.region = region;
  }

  const version = draft.version.trim();
  if (version) {
    if (!/^\d+(\.\d+){0,2}$/.test(version))
      return { patch, error: "Version must look like 3, 3.1 or 3.1.4." };
    patch.version = version;
  }

  const endpoint = draft.endpoint.trim();
  if (endpoint) {
    if (!/^https:\/\/[\w.-]+(:\d+)?(\/\S*)?$/.test(endpoint))
      return { patch, error: "Endpoint must be an https:// URL." };
    patch.endpoint = endpoint;
  }

  const latency = draft.latency_ms.trim();
  if (latency) {
    const value = Number(latency);
    if (!Number.isFinite(value) || value < 1 || value > 60_000)
      return { patch, error: "Latency budget must be between 1 and 60000 ms." };
    patch.latency_ms = Math.round(value);
  }

  if (Object.keys(patch).length === 0)
    return { patch, error: "Change at least one setting before applying." };
  return { patch, error: null };
}

const FIELD_LABELS: Record<string, string> = {
  enabled: "Enablement",
  region: "Region",
  version: "Version",
  endpoint: "Endpoint",
  latency_ms: "Latency budget",
};

function describe(value: unknown) {
  if (typeof value === "boolean") return value ? "enabled" : "disabled";
  return String(value);
}

/**
 * Bulk configuration editor for AI engines.
 *
 * Every field is validated before anything is sent, the operator confirms an
 * explicit before/after preview, and the database trigger records a
 * field-by-field diff per engine in the change history.
 */
export function BulkEngineConfigDialog({
  open,
  onOpenChange,
  engines,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  engines: AiEngine[];
  onApplied: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<EngineDraft>(EMPTY);
  const [preview, setPreview] = useState(false);

  const { patch, error } = useMemo(() => buildEnginePatch(draft), [draft]);
  const fields = Object.keys(patch) as (keyof AiEngine)[];

  const apply = useMutation({
    mutationFn: () =>
      bulkUpdateEngines(
        engines.map((e) => e.id),
        patch,
      ),
    onSuccess: (count) => {
      toast.success(`${count} engine${count === 1 ? "" : "s"} updated`, {
        description: "Each field change is attributed to you in the engine change history.",
      });
      queryClient.invalidateQueries({ queryKey: ["infrastructure"] });
      setDraft(EMPTY);
      setPreview(false);
      onApplied();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (key: keyof EngineDraft, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" /> Bulk engine configuration
          </DialogTitle>
          <DialogDescription>
            Applies to {engines.length} selected engine{engines.length === 1 ? "" : "s"}. Blank
            fields are left untouched, and you will see a preview before anything is written.
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface/50 p-3 text-xs">
              <p className="mb-2 font-medium">Changes to apply</p>
              <div className="flex flex-wrap gap-2">
                {fields.map((field) => (
                  <StatusPill
                    key={String(field)}
                    label={`${FIELD_LABELS[String(field)] ?? String(field)} → ${describe(patch[field])}`}
                    tone="info"
                  />
                ))}
              </div>
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {engines.map((engine) => (
                <div
                  key={engine.id}
                  className="rounded-lg border border-border bg-background/50 px-3 py-2 text-[11px]"
                >
                  <p className="text-xs font-medium">{engine.name}</p>
                  <div className="mt-1 grid gap-0.5">
                    {fields.map((field) => (
                      <div key={String(field)} className="flex items-baseline gap-2 font-mono">
                        <span className="w-28 shrink-0 text-muted-foreground">{String(field)}</span>
                        <span className="text-muted-foreground line-through">
                          {describe(engine[field])}
                        </span>
                        <span>→ {describe(patch[field])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Enablement</Label>
              <Select value={draft.enabled} onValueChange={(value) => set("enabled", value)}>
                <SelectTrigger className="bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unchanged">Leave unchanged</SelectItem>
                  <SelectItem value="enabled">Enable engines</SelectItem>
                  <SelectItem value="disabled">Disable engines</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="Region" hint="e.g. uae-north">
              <Input
                value={draft.region}
                maxLength={32}
                className="bg-surface"
                onChange={(event) => set("region", event.target.value)}
              />
            </Field>
            <Field label="Version" hint="e.g. 3.1.4">
              <Input
                value={draft.version}
                maxLength={16}
                className="bg-surface"
                onChange={(event) => set("version", event.target.value)}
              />
            </Field>
            <Field label="Latency budget (ms p95)" hint="1 – 60000">
              <Input
                value={draft.latency_ms}
                inputMode="numeric"
                maxLength={6}
                className="bg-surface"
                onChange={(event) => set("latency_ms", event.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Endpoint" hint="Must be an https:// URL">
                <Input
                  value={draft.endpoint}
                  maxLength={200}
                  className="bg-surface"
                  onChange={(event) => set("endpoint", event.target.value)}
                  placeholder="https://speech.aegisiq.internal/v1"
                />
              </Field>
            </div>
            <label className="flex items-start gap-2 text-[11px] text-muted-foreground sm:col-span-2">
              <Checkbox checked disabled className="mt-0.5" />
              Every change is written to the engine change history with your name and the before and
              after values.
            </label>
          </div>
        )}

        {error && !preview && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {preview ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setPreview(false)}>
                Back to edit
              </Button>
              <Button size="sm" disabled={apply.isPending} onClick={() => apply.mutate()}>
                {apply.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Apply to {engines.length} engine{engines.length === 1 ? "" : "s"}
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={error !== null} onClick={() => setPreview(true)}>
              Preview changes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
