/**
 * Bulk alert triage with per-alert results.
 *
 * Row-level security (`can_triage_alert`) is the enforcement point; this module
 * mirrors the same capability + outlet-scope rules client-side so the operator
 * gets a precise, per-alert outcome instead of one opaque failure, and updates
 * each alert individually so a single rejection never blocks the rest.
 */
import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import type { AlertStatus } from "@/features/platform/queries";
import type { AlertAction } from "./access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

export const ACTION_STATUS: Record<Exclude<AlertAction, "assign">, AlertStatus> = {
  acknowledge: "acknowledged",
  resolve: "resolved",
  dismiss: "dismissed",
};

export interface BulkTriageTarget {
  id: string;
  title: string;
  outlet_id: string | null;
  status: string;
}

export interface BulkTriageResult {
  id: string;
  title: string;
  outcome: "updated" | "skipped" | "denied" | "failed";
  reason: string | null;
}

export interface BulkTriageSummary {
  action: Exclude<AlertAction, "assign">;
  status: AlertStatus;
  results: BulkTriageResult[];
  updated: number;
  denied: number;
  skipped: number;
  failed: number;
}

export interface BulkTriageOptions {
  /** Returns a deny reason for an alert, or null when the action is allowed. */
  denyReason: (action: AlertAction, outletId: string | null) => string | null;
}

/**
 * Applies a triage action to each alert in turn and reports what happened to
 * every one of them.
 */
export async function bulkTriageAlerts(
  targets: BulkTriageTarget[],
  action: Exclude<AlertAction, "assign">,
  options: BulkTriageOptions,
): Promise<BulkTriageSummary> {
  const status = ACTION_STATUS[action];
  const companyId = getActiveTenant();
  if (!companyId) throw new Error("No active workspace resolved yet.");

  const results: BulkTriageResult[] = [];

  for (const target of targets) {
    const denied = options.denyReason(action, target.outlet_id);
    if (denied) {
      results.push({ id: target.id, title: target.title, outcome: "denied", reason: denied });
      continue;
    }
    if (target.status === status) {
      results.push({
        id: target.id,
        title: target.title,
        outcome: "skipped",
        reason: `Already ${status}`,
      });
      continue;
    }

    const patch: Record<string, unknown> = { status };
    if (status !== "open") patch.acknowledged_at = new Date().toISOString();

    const { error } = await raw
      .from("alerts")
      .update(patch)
      .eq("company_id", companyId)
      .eq("id", target.id);

    if (error) {
      const denialByRls = /row-level security|permission/i.test(error.message);
      results.push({
        id: target.id,
        title: target.title,
        outcome: denialByRls ? "denied" : "failed",
        reason: denialByRls ? "Blocked by workspace access rules." : error.message,
      });
      continue;
    }
    results.push({ id: target.id, title: target.title, outcome: "updated", reason: null });
  }

  const count = (outcome: BulkTriageResult["outcome"]) =>
    results.filter((r) => r.outcome === outcome).length;

  return {
    action,
    status,
    results,
    updated: count("updated"),
    denied: count("denied"),
    skipped: count("skipped"),
    failed: count("failed"),
  };
}
