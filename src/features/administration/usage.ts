/**
 * Metered usage, quota governance and pricing.
 *
 * Consumption is aggregated per workspace/outlet/month in `usage_counters`;
 * allowances, overage pricing and throttling live in `usage_plans` and
 * `outlet_quotas`. Every read below is tenant scoped by row-level security —
 * the database, not the client, is the enforcement point.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";

// The generated types lag behind this migration; the RLS policies are the gate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = supabase as unknown as { from: (table: string) => any; rpc: (fn: string, args?: unknown) => any };

export type ThrottleMode = "off" | "warn" | "block";

export interface UsagePlan {
  id: string;
  company_id: string;
  plan_name: string;
  currency: string;
  monthly_budget: number;
  included_queries: number;
  included_audio_minutes: number;
  included_storage_gb: number;
  included_egress_gb: number;
  overage_query_price: number;
  overage_audio_minute_price: number;
  overage_storage_gb_price: number;
  overage_egress_gb_price: number;
  throttle_mode: ThrottleMode;
  throttle_threshold_pct: number;
  hard_budget_stop: boolean;
}

export interface OutletQuota {
  id: string;
  outlet_id: string;
  query_limit: number;
  audio_minutes_limit: number;
  throttle_enabled: boolean;
  notes: string | null;
}

export interface UsageOutletRow {
  id: string;
  name: string;
  code: string | null;
  region: string | null;
  queries: number;
  audio_minutes: number;
  storage_gb: number;
  egress_gb: number;
  query_limit: number;
  audio_minutes_limit: number;
  throttle_enabled: boolean;
}

export interface UsageOverview {
  month: string;
  plan: UsagePlan | null;
  totals: {
    queries: number;
    audio_minutes: number;
    storage_gb: number;
    egress_gb: number;
    ai_tokens: number;
  };
  outlets: UsageOutletRow[];
  trend: { period_month: string; queries: number; audio_minutes: number; egress_gb: number }[];
}

export const usagePlanQuery = queryOptions({
  queryKey: ["usage", "plan"],
  queryFn: async () => {
    const { data, error } = await raw.from("usage_plans").select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as UsagePlan | null;
  },
});

export const outletQuotasQuery = queryOptions({
  queryKey: ["usage", "outlet-quotas"],
  queryFn: async () => {
    const { data, error } = await raw.from("outlet_quotas").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as OutletQuota[];
  },
});

export const usageOverviewQuery = queryOptions({
  queryKey: ["usage", "overview"],
  queryFn: async () => {
    const { data, error } = await raw.rpc("usage_overview", {});
    if (error) throw new Error(error.message);
    return (data ?? {
      month: new Date().toISOString().slice(0, 10),
      plan: null,
      totals: { queries: 0, audio_minutes: 0, storage_gb: 0, egress_gb: 0, ai_tokens: 0 },
      outlets: [],
      trend: [],
    }) as UsageOverview;
  },
});

export async function saveUsagePlan(patch: Partial<UsagePlan>) {
  const company = getActiveTenant();
  if (!company) throw new Error("No workspace in context");
  const { error } = await raw
    .from("usage_plans")
    .upsert({ company_id: company, ...patch }, { onConflict: "company_id" });
  if (error) throw new Error(error.message);
}

export async function saveOutletQuota(outletId: string, patch: Partial<OutletQuota>) {
  const company = getActiveTenant();
  if (!company) throw new Error("No workspace in context");
  const { error } = await raw
    .from("outlet_quotas")
    .upsert({ company_id: company, outlet_id: outletId, ...patch }, { onConflict: "outlet_id" });
  if (error) throw new Error(error.message);
}

export interface QuotaVerdict {
  allowed: boolean;
  reason?: string;
  scope?: "tenant" | "outlet";
  warn?: boolean;
  used?: number;
  limit?: number;
  tenantPct?: number;
  outletUsed?: number;
  outletLimit?: number;
}

/** Pre-flight gate: called before any Copilot command consumes tokens. */
export async function checkCopilotQuota(outletId?: string | null): Promise<QuotaVerdict> {
  try {
    const { data, error } = await raw.rpc("check_copilot_quota", {
      _outlet_id: outletId ?? null,
    });
    if (error) throw new Error(error.message);
    return (data ?? { allowed: true }) as QuotaVerdict;
  } catch {
    // Metering must never take the copilot offline.
    return { allowed: true };
  }
}

/** Fire-and-forget meter increment. */
export async function recordUsage(
  metric: "copilot_queries" | "audio_minutes" | "storage_gb" | "egress_gb" | "ai_tokens",
  quantity = 1,
  outletId?: string | null,
) {
  try {
    await raw.rpc("record_usage", {
      _metric: metric,
      _quantity: quantity,
      _outlet_id: outletId ?? null,
    });
  } catch {
    /* metering is best-effort */
  }
}

export function quotaDeniedMessage(verdict: QuotaVerdict) {
  switch (verdict.reason) {
    case "outlet_quota_exceeded":
      return `This outlet has used its monthly Copilot allowance (${verdict.used}/${verdict.limit} queries). Ask a workspace admin to raise the quota.`;
    case "tenant_quota_exceeded":
      return `The workspace has reached its included Copilot queries (${verdict.used}/${verdict.limit}) and throttling is set to block.`;
    case "budget_exceeded":
      return "The workspace monthly budget cap has been reached — Copilot is paused until the next cycle or the budget is raised.";
    default:
      return "Copilot is currently throttled for this workspace.";
  }
}

/* -------------------------------------------------------------------- */
/* Pricing configurator (super admin)                                    */
/* -------------------------------------------------------------------- */

export interface PricingScenario {
  id: string;
  name: string;
  currency: string;
  outlets: number;
  cameras_per_outlet: number;
  included_query_packs: number;
  queries_per_pack: number;
  audio_hours_per_outlet: number;
  platform_fee: number;
  price_per_outlet: number;
  price_per_camera: number;
  price_per_query_pack: number;
  price_per_audio_hour: number;
  cost_per_outlet: number;
  cost_per_query: number;
  cost_per_audio_hour: number;
  target_margin_pct: number;
  notes: string | null;
  updated_at: string;
}

export type PricingInputs = Omit<PricingScenario, "id" | "updated_at" | "notes"> & {
  notes?: string | null;
};

export const DEFAULT_PRICING: PricingInputs = {
  name: "Singapore retail — Professional",
  currency: "SGD",
  outlets: 10,
  cameras_per_outlet: 6,
  included_query_packs: 4,
  queries_per_pack: 1000,
  audio_hours_per_outlet: 300,
  platform_fee: 2000,
  price_per_outlet: 699,
  price_per_camera: 45,
  price_per_query_pack: 320,
  price_per_audio_hour: 1.2,
  cost_per_outlet: 120,
  cost_per_query: 0.08,
  cost_per_audio_hour: 0.35,
  target_margin_pct: 200,
};

export interface PricingResult {
  cameras: number;
  includedQueries: number;
  audioHours: number;
  revenue: { platform: number; outlets: number; cameras: number; queries: number; audio: number; total: number };
  cost: { outlets: number; queries: number; audio: number; total: number };
  grossProfit: number;
  marginPct: number;
  perOutlet: number;
  targetPrice: number;
  targetGap: number;
  annual: number;
}

/** Pure model: what a tenant costs us and what it should be billed. */
export function computePricing(input: PricingInputs): PricingResult {
  const cameras = input.outlets * input.cameras_per_outlet;
  const includedQueries = input.included_query_packs * input.queries_per_pack * input.outlets;
  const audioHours = input.audio_hours_per_outlet * input.outlets;

  const revenue = {
    platform: input.platform_fee,
    outlets: input.outlets * input.price_per_outlet,
    cameras: cameras * input.price_per_camera,
    queries: input.outlets * input.included_query_packs * input.price_per_query_pack,
    audio: audioHours * input.price_per_audio_hour,
    total: 0,
  };
  revenue.total =
    revenue.platform + revenue.outlets + revenue.cameras + revenue.queries + revenue.audio;

  const cost = {
    outlets: input.outlets * input.cost_per_outlet,
    queries: includedQueries * input.cost_per_query,
    audio: audioHours * input.cost_per_audio_hour,
    total: 0,
  };
  cost.total = cost.outlets + cost.queries + cost.audio;

  const grossProfit = revenue.total - cost.total;
  const marginPct = cost.total === 0 ? 0 : (grossProfit / cost.total) * 100;
  const targetPrice = cost.total * (1 + input.target_margin_pct / 100);

  return {
    cameras,
    includedQueries,
    audioHours,
    revenue,
    cost,
    grossProfit,
    marginPct,
    perOutlet: input.outlets === 0 ? 0 : revenue.total / input.outlets,
    targetPrice,
    targetGap: revenue.total - targetPrice,
    annual: revenue.total * 12,
  };
}

export const pricingScenariosQuery = queryOptions({
  queryKey: ["pricing-scenarios"],
  queryFn: async () => {
    const { data, error } = await raw
      .from("pricing_scenarios")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PricingScenario[];
  },
});

export async function savePricingScenario(input: PricingInputs, id?: string) {
  const company = getActiveTenant();
  if (!company) throw new Error("No workspace in context");
  const { data: auth } = await supabase.auth.getUser();
  const row = { ...input, company_id: company, created_by: auth.user?.id ?? null };
  const { error } = id
    ? await raw.from("pricing_scenarios").update(row).eq("id", id)
    : await raw.from("pricing_scenarios").insert(row);
  if (error) throw new Error(error.message);
}

export async function deletePricingScenario(id: string) {
  const { error } = await raw.from("pricing_scenarios").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
