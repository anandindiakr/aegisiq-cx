import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Trash2, Wallet } from "lucide-react";

import { EmptyState, LoadingState, Panel, StatusPill } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PRICING,
  computePricing,
  deletePricingScenario,
  pricingScenariosQuery,
  savePricingScenario,
  type PricingInputs,
} from "@/features/administration/usage";

export const Route = createFileRoute("/_authenticated/platform/pricing")({
  head: () => ({
    meta: [
      { title: "Tenant Pricing Configurator — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Model estimated monthly cost and margin for a tenant from outlets, cameras, included query packs and expected audio hours.",
      },
      { property: "og:title", content: "Tenant Pricing Configurator — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Commercial modelling for AegisIQ CX deployments, with margin targets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingConfigurator,
});

function Field({
  label,
  value,
  step = 1,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  hint?: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PricingConfigurator() {
  const queryClient = useQueryClient();
  const scenarios = useQuery(pricingScenariosQuery);
  const [input, setInput] = useState<PricingInputs>(DEFAULT_PRICING);
  const [editingId, setEditingId] = useState<string | undefined>();

  const set = <K extends keyof PricingInputs>(key: K, value: PricingInputs[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(() => computePricing(input), [input]);
  const money = (n: number) =>
    new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: input.currency || "SGD",
      maximumFractionDigits: 0,
    }).format(n);
  const nf = new Intl.NumberFormat("en-SG");

  const save = useMutation({
    mutationFn: () => savePricingScenario(input, editingId),
    onSuccess: () => {
      toast.success(editingId ? "Scenario updated" : "Scenario saved");
      void queryClient.invalidateQueries({ queryKey: ["pricing-scenarios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePricingScenario(id),
    onSuccess: () => {
      toast.success("Scenario removed");
      void queryClient.invalidateQueries({ queryKey: ["pricing-scenarios"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Panel title="Deployment shape" description="What the tenant is actually running">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Scenario name</Label>
                <Input value={input.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Currency</Label>
                <Select value={input.currency} onValueChange={(v) => set("currency", v)}>
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
              <Field label="Outlets" value={input.outlets} onChange={(n) => set("outlets", n)} />
              <Field
                label="Cameras per outlet"
                value={input.cameras_per_outlet}
                onChange={(n) => set("cameras_per_outlet", n)}
              />
              <Field
                label="Included query packs / outlet"
                value={input.included_query_packs}
                onChange={(n) => set("included_query_packs", n)}
              />
              <Field
                label="Queries per pack"
                value={input.queries_per_pack}
                step={100}
                onChange={(n) => set("queries_per_pack", n)}
              />
              <Field
                label="Expected audio hours / outlet"
                value={input.audio_hours_per_outlet}
                step={10}
                onChange={(n) => set("audio_hours_per_outlet", n)}
              />
            </div>
          </Panel>

          <Panel title="List pricing" description="What the tenant is billed each month">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Platform fee" value={input.platform_fee} step={50} onChange={(n) => set("platform_fee", n)} />
              <Field label="Price per outlet" value={input.price_per_outlet} step={10} onChange={(n) => set("price_per_outlet", n)} />
              <Field label="Price per camera" value={input.price_per_camera} step={5} onChange={(n) => set("price_per_camera", n)} />
              <Field label="Price per query pack" value={input.price_per_query_pack} step={10} onChange={(n) => set("price_per_query_pack", n)} />
              <Field label="Price per audio hour" value={input.price_per_audio_hour} step={0.1} onChange={(n) => set("price_per_audio_hour", n)} />
            </div>
          </Panel>

          <Panel title="Delivery cost & margin target" description="Infrastructure, tokens and speech processing">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Cost per outlet" value={input.cost_per_outlet} step={5} onChange={(n) => set("cost_per_outlet", n)} />
              <Field label="Cost per query" value={input.cost_per_query} step={0.01} onChange={(n) => set("cost_per_query", n)} />
              <Field label="Cost per audio hour" value={input.cost_per_audio_hour} step={0.05} onChange={(n) => set("cost_per_audio_hour", n)} />
              <Field
                label="Target margin (%)"
                value={input.target_margin_pct}
                step={10}
                hint="Gross profit as a share of delivery cost"
                onChange={(n) => set("target_margin_pct", n)}
              />
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  rows={2}
                  value={input.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </div>
          </Panel>
        </div>

        <Panel
          title="Estimated monthly cost"
          description={`${nf.format(result.cameras)} cameras · ${nf.format(result.includedQueries)} included queries · ${nf.format(result.audioHours)} audio hours`}
          actions={
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="size-4" /> Save
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/25 bg-primary/8 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Monthly contract value
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{money(result.revenue.total)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {money(result.perOutlet)} per outlet · {money(result.annual)} annualised
              </p>
            </div>

            <dl className="space-y-2 text-sm">
              {[
                ["Platform fee", result.revenue.platform],
                ["Outlet licences", result.revenue.outlets],
                ["Camera licences", result.revenue.cameras],
                ["Query packs", result.revenue.queries],
                ["Audio processing", result.revenue.audio],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{money(value as number)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-border pt-2">
                <dt className="text-muted-foreground">Delivery cost</dt>
                <dd className="tabular-nums text-destructive">-{money(result.cost.total)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Gross profit</dt>
                <dd className="tabular-nums font-medium">{money(result.grossProfit)}</dd>
              </div>
            </dl>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-xs text-muted-foreground">Achieved margin</p>
                <p className="text-lg font-semibold tabular-nums">{result.marginPct.toFixed(0)}%</p>
              </div>
              <StatusPill
                label={
                  result.marginPct >= input.target_margin_pct ? "target met" : "below target"
                }
                tone={result.marginPct >= input.target_margin_pct ? "positive" : "warning"}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Price needed for a {input.target_margin_pct}% margin: {money(result.targetPrice)} (
              {result.targetGap >= 0 ? "+" : ""}
              {money(result.targetGap)} vs current).
            </p>
          </div>
        </Panel>
      </div>

      <Panel title="Saved scenarios" description="Reusable commercial models for tenant negotiations">
        {scenarios.isPending ? (
          <LoadingState rows={3} />
        ) : (scenarios.data ?? []).length ? (
          <div className="space-y-2">
            {(scenarios.data ?? []).map((scenario) => {
              const modelled = computePricing(scenario);
              return (
                <div
                  key={scenario.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{scenario.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {scenario.outlets} outlets · {scenario.cameras_per_outlet} cameras each ·{" "}
                      {modelled.marginPct.toFixed(0)}% margin
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {new Intl.NumberFormat("en-SG", {
                        style: "currency",
                        currency: scenario.currency || "SGD",
                        maximumFractionDigits: 0,
                      }).format(modelled.revenue.total)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setInput({ ...(scenario as unknown as PricingInputs) });
                        setEditingId(scenario.id);
                      }}
                    >
                      <Wallet className="size-4" /> Load
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove.mutate(scenario.id)}
                      aria-label={`Delete ${scenario.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No saved scenarios"
            description="Model a deployment above and save it for reuse."
          />
        )}
      </Panel>
    </div>
  );
}
