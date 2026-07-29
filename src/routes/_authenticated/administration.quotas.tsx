import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, ShieldAlert } from "lucide-react";

import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
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
import { outletsQuery } from "@/features/platform/queries";
import {
  outletQuotasQuery,
  saveOutletQuota,
  saveUsagePlan,
  usagePlanQuery,
  type UsagePlan,
} from "@/features/administration/usage";

export const Route = createFileRoute("/_authenticated/administration/quotas")({
  head: () => ({
    meta: [
      { title: "Copilot Quotas & Overage — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Set per-tenant and per-outlet Copilot query limits, audio-hour quotas, overage pricing and automatic throttling so token spend stays inside budget.",
      },
      { property: "og:title", content: "Copilot Quotas & Overage — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Budget guardrails for Copilot queries, audio hours, storage and egress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuotasPage,
});

type PlanDraft = Partial<UsagePlan>;

function NumberField({
  label,
  hint,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function QuotasPage() {
  const queryClient = useQueryClient();
  const plan = useQuery(usagePlanQuery);
  const quotas = useQuery(outletQuotasQuery);
  const outlets = useQuery(outletsQuery);

  const [draft, setDraft] = useState<PlanDraft>({});
  useEffect(() => {
    if (plan.data) setDraft(plan.data);
  }, [plan.data]);

  const set = <K extends keyof UsagePlan>(key: K, value: UsagePlan[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const savePlan = useMutation({
    mutationFn: () => saveUsagePlan(draft),
    onSuccess: () => {
      toast.success("Budget and throttling policy saved");
      void queryClient.invalidateQueries({ queryKey: ["usage"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveQuota = useMutation({
    mutationFn: ({ outletId, patch }: { outletId: string; patch: Record<string, unknown> }) =>
      saveOutletQuota(outletId, patch),
    onSuccess: () => {
      toast.success("Outlet quota updated");
      void queryClient.invalidateQueries({ queryKey: ["usage"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quotaByOutlet = useMemo(() => {
    const map = new Map<string, { query_limit: number; audio_minutes_limit: number; throttle_enabled: boolean }>();
    for (const q of quotas.data ?? []) map.set(q.outlet_id, q);
    return map;
  }, [quotas.data]);

  if (plan.isPending || quotas.isPending || outlets.isPending) return <LoadingState rows={8} />;
  if (plan.error) return <ErrorState message={(plan.error as Error).message} onRetry={() => void plan.refetch()} />;

  const outletRows = outlets.data ?? [];

  return (
    <div className="space-y-6">
      <Panel
        title="Workspace budget & allowances"
        description="Included entitlement for the tenant. Consumption beyond these numbers bills at the overage rates below."
        actions={
          <Button size="sm" onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>
            <Save className="size-4" /> Save policy
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Plan name</Label>
            <Input
              value={draft.plan_name ?? ""}
              onChange={(e) => set("plan_name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Currency</Label>
            <Select value={draft.currency ?? "SGD"} onValueChange={(v) => set("currency", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["SGD", "USD", "MYR", "AUD", "EUR", "GBP", "INR"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NumberField
            label="Monthly budget cap"
            hint="Maximum overage spend tolerated in one cycle"
            value={Number(draft.monthly_budget ?? 0)}
            step={50}
            onChange={(n) => set("monthly_budget", n)}
          />
          <NumberField
            label="Included Copilot queries"
            value={Number(draft.included_queries ?? 0)}
            step={500}
            onChange={(n) => set("included_queries", n)}
          />
          <NumberField
            label="Included audio minutes"
            value={Number(draft.included_audio_minutes ?? 0)}
            step={500}
            onChange={(n) => set("included_audio_minutes", n)}
          />
          <NumberField
            label="Included storage (GB)"
            value={Number(draft.included_storage_gb ?? 0)}
            step={10}
            onChange={(n) => set("included_storage_gb", n)}
          />
          <NumberField
            label="Included egress (GB)"
            value={Number(draft.included_egress_gb ?? 0)}
            step={10}
            onChange={(n) => set("included_egress_gb", n)}
          />
        </div>
      </Panel>

      <Panel
        title="Overage pricing"
        description="Unit rates applied to every unit consumed beyond the included allowance."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <NumberField
            label="Per extra Copilot query"
            value={Number(draft.overage_query_price ?? 0)}
            step={0.01}
            onChange={(n) => set("overage_query_price", n)}
          />
          <NumberField
            label="Per extra audio minute"
            value={Number(draft.overage_audio_minute_price ?? 0)}
            step={0.01}
            onChange={(n) => set("overage_audio_minute_price", n)}
          />
          <NumberField
            label="Per extra storage GB"
            value={Number(draft.overage_storage_gb_price ?? 0)}
            step={0.01}
            onChange={(n) => set("overage_storage_gb_price", n)}
          />
          <NumberField
            label="Per extra egress GB"
            value={Number(draft.overage_egress_gb_price ?? 0)}
            step={0.01}
            onChange={(n) => set("overage_egress_gb_price", n)}
          />
        </div>
      </Panel>

      <Panel
        title="Automatic throttling"
        description="What happens when the workspace runs past its included quota."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Throttle mode</Label>
            <Select
              value={draft.throttle_mode ?? "warn"}
              onValueChange={(v) => set("throttle_mode", v as UsagePlan["throttle_mode"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off — allow unlimited overage</SelectItem>
                <SelectItem value="warn">Warn — notify at threshold</SelectItem>
                <SelectItem value="block">Block — stop Copilot at quota</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <NumberField
            label="Warning threshold (%)"
            hint="Users are warned once consumption crosses this share of the allowance"
            value={Number(draft.throttle_threshold_pct ?? 90)}
            step={5}
            onChange={(n) => set("throttle_threshold_pct", n)}
          />
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Hard budget stop</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Pause Copilot entirely once projected overage exceeds the monthly budget cap.
              </p>
            </div>
            <Switch
              checked={!!draft.hard_budget_stop}
              onCheckedChange={(v) => set("hard_budget_stop", v)}
            />
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldAlert className="size-3.5" /> Throttling is enforced server-side before any token
          is spent, so a blocked query never reaches the AI gateway.
        </p>
      </Panel>

      <Panel
        title="Per-outlet Copilot limits"
        description="Cap how much any single site can consume from the shared workspace allowance."
      >
        {outletRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Outlet</th>
                  <th className="pb-2 pr-3 font-medium">Query limit / month</th>
                  <th className="pb-2 pr-3 font-medium">Audio minutes / month</th>
                  <th className="pb-2 pr-3 font-medium">Throttle</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {outletRows.map((outlet) => {
                  const current = quotaByOutlet.get(outlet.id);
                  return (
                    <OutletQuotaRow
                      key={outlet.id}
                      name={outlet.name}
                      region={outlet.region ?? null}
                      queryLimit={current?.query_limit ?? 1500}
                      audioLimit={current?.audio_minutes_limit ?? 5000}
                      throttle={current?.throttle_enabled ?? true}
                      saving={saveQuota.isPending}
                      onSave={(patch) => saveQuota.mutate({ outletId: outlet.id, patch })}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No outlets" description="Add outlets before assigning quotas." />
        )}
      </Panel>
    </div>
  );
}

function OutletQuotaRow({
  name,
  region,
  queryLimit,
  audioLimit,
  throttle,
  saving,
  onSave,
}: {
  name: string;
  region: string | null;
  queryLimit: number;
  audioLimit: number;
  throttle: boolean;
  saving: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [q, setQ] = useState(queryLimit);
  const [a, setA] = useState(audioLimit);
  const [t, setT] = useState(throttle);
  const dirty = q !== queryLimit || a !== audioLimit || t !== throttle;

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="py-2.5 pr-3">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{region ?? "—"}</p>
      </td>
      <td className="py-2.5 pr-3">
        <Input type="number" className="w-32" value={q} onChange={(e) => setQ(Number(e.target.value))} />
      </td>
      <td className="py-2.5 pr-3">
        <Input type="number" className="w-32" value={a} onChange={(e) => setA(Number(e.target.value))} />
      </td>
      <td className="py-2.5 pr-3">
        <Switch checked={t} onCheckedChange={setT} />
      </td>
      <td className="py-2.5">
        <Button
          size="sm"
          variant="outline"
          disabled={!dirty || saving}
          onClick={() =>
            onSave({ query_limit: q, audio_minutes_limit: a, throttle_enabled: t })
          }
        >
          Save
        </Button>
      </td>
    </tr>
  );
}
