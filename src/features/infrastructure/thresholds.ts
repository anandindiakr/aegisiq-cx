/**
 * Configurable device and stream health thresholds.
 *
 * Admins set a warning and a critical limit per metric; a database function
 * evaluates every live audio stream against them and raises in-app alerts for
 * breaches (deduplicated to one alert per device and metric per hour).
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import { traced } from "@/lib/observability";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as {
  from: (table: string) => AnyBuilder;
  rpc: (fn: string, args?: Record<string, unknown>) => AnyBuilder;
};

function tenant(): string {
  const id = getActiveTenant();
  if (!id) throw new Error("No active workspace resolved yet.");
  return id;
}

export type ThresholdMetric = "latency_ms" | "packet_loss" | "noise_floor_db" | "signal_quality";

export interface HealthThreshold {
  id: string;
  metric: ThresholdMetric;
  label: string;
  unit: string;
  /** `above` breaches when the reading rises, `below` when it falls. */
  comparator: "above" | "below";
  warn_value: number;
  critical_value: number;
  enabled: boolean;
  updated_at: string;
}

export const METRIC_HINTS: Record<string, string> = {
  latency_ms: "End-to-end audio latency measured at the gateway ingest.",
  packet_loss: "Percentage of RTP packets dropped over the last sampling window.",
  noise_floor_db: "Ambient noise floor; closer to zero means a noisier microphone.",
  signal_quality: "Composite signal score — a fall below the limit means signal loss.",
};

export const thresholdsQuery = queryOptions({
  queryKey: ["infrastructure", "thresholds"],
  queryFn: () =>
    traced("supabase.infra-thresholds", async () => {
      const { data, error } = await raw
        .from("infra_health_thresholds")
        .select("id,metric,label,unit,comparator,warn_value,critical_value,enabled,updated_at")
        .eq("company_id", tenant())
        .order("label");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: HealthThreshold) => ({
        ...row,
        warn_value: Number(row.warn_value),
        critical_value: Number(row.critical_value),
      })) as HealthThreshold[];
    }),
  staleTime: 30_000,
});

export interface ThresholdPatch {
  warn_value?: number;
  critical_value?: number;
  enabled?: boolean;
}

/** Rejects limits that could never fire or that invert warning and critical. */
export function validateThreshold(
  threshold: HealthThreshold,
  patch: ThresholdPatch,
): string | null {
  const warn = patch.warn_value ?? threshold.warn_value;
  const critical = patch.critical_value ?? threshold.critical_value;
  if (!Number.isFinite(warn) || !Number.isFinite(critical)) return "Both limits must be numbers.";
  if (threshold.comparator === "above" && critical <= warn)
    return "The critical limit must be higher than the warning limit.";
  if (threshold.comparator === "below" && critical >= warn)
    return "The critical limit must be lower than the warning limit.";
  if (threshold.metric === "packet_loss" && (warn < 0 || critical > 100))
    return "Packet loss must sit between 0% and 100%.";
  if (threshold.metric === "signal_quality" && (critical < 0 || warn > 100))
    return "Signal quality must sit between 0% and 100%.";
  if (threshold.metric === "latency_ms" && warn < 1) return "Latency limits must be positive.";
  return null;
}

export async function updateThreshold(id: string, patch: ThresholdPatch) {
  const { error } = await raw
    .from("infra_health_thresholds")
    .update(patch)
    .eq("company_id", tenant())
    .eq("id", id);
  if (error) {
    throw new Error(
      /row-level|permission/i.test(error.message)
        ? "Only workspace admins can change health thresholds."
        : error.message,
    );
  }
}

/** Runs the breach sweep and returns how many alerts were raised. */
export async function evaluateInfraHealth(): Promise<number> {
  const { data, error } = await raw.rpc("evaluate_infra_health");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export interface StreamReading {
  latency_ms: number;
  packet_loss: number;
  noise_floor_db: number;
  signal_quality: number;
}

export type BreachLevel = "ok" | "warn" | "critical";

/** Client-side mirror of the database rule, used for live indicators. */
export function evaluateReading(threshold: HealthThreshold, reading: StreamReading): BreachLevel {
  const value = reading[threshold.metric as keyof StreamReading];
  if (value === undefined || value === null || !threshold.enabled) return "ok";
  if (threshold.comparator === "above") {
    if (value >= threshold.critical_value) return "critical";
    if (value >= threshold.warn_value) return "warn";
    return "ok";
  }
  if (value <= threshold.critical_value) return "critical";
  if (value <= threshold.warn_value) return "warn";
  return "ok";
}

export function breachTone(level: BreachLevel): "positive" | "warning" | "negative" {
  if (level === "critical") return "negative";
  if (level === "warn") return "warning";
  return "positive";
}
