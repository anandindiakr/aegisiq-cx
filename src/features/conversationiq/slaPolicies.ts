import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";
import { getActiveTenant, type AppRole } from "@/features/platform/queries";
import type { QueuePriority, ReviewAssignment } from "./queue";

/**
 * Configurable SLA thresholds per reviewer queue.
 *
 * Each priority lane can have a default policy: a target time, a warning
 * threshold expressed as a percentage of that target, and an ordered set of
 * escalation steps with their own delays measured from the moment the item
 * breaches. The queue and SLA watcher read these instead of hard-coded values.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

export type EscalationAction = "notify" | "escalate" | "reassign" | "page";

export const ESCALATION_ACTIONS: EscalationAction[] = [
  "notify",
  "escalate",
  "reassign",
  "page",
];

export const ESCALATION_ACTION_LABELS: Record<EscalationAction, string> = {
  notify: "Notify",
  escalate: "Escalate",
  reassign: "Reassign",
  page: "Page on-call",
};

export interface SlaEscalationStep {
  id: string;
  policy_id: string;
  step_order: number;
  delay_minutes: number;
  action: EscalationAction;
  notify_role: AppRole | null;
  notify_email: string | null;
  note: string | null;
  is_active: boolean;
}

export interface SlaPolicy {
  id: string;
  name: string;
  description: string | null;
  priority: QueuePriority;
  target_minutes: number;
  warning_percent: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SlaPolicyWithSteps extends SlaPolicy {
  steps: SlaEscalationStep[];
}

const POLICY_COLUMNS =
  "id,name,description,priority,target_minutes,warning_percent,is_default,is_active,created_at,updated_at";
const STEP_COLUMNS =
  "id,policy_id,step_order,delay_minutes,action,notify_role,notify_email,note,is_active";

export const slaPoliciesQuery = queryOptions({
  queryKey: ["iq", "sla-policies"],
  queryFn: () =>
    traced("iq.sla_policies", async () => {
      const company = getActiveTenant();
      let policies = raw
        .from("sla_policies")
        .select(POLICY_COLUMNS)
        .order("target_minutes", { ascending: true });
      let steps = raw
        .from("sla_escalation_steps")
        .select(STEP_COLUMNS)
        .order("step_order", { ascending: true });
      if (company) {
        policies = policies.eq("company_id", company);
        steps = steps.eq("company_id", company);
      }
      const [policyResult, stepResult] = await Promise.all([policies, steps]);
      if (policyResult.error) throw new Error(policyResult.error.message);
      if (stepResult.error) throw new Error(stepResult.error.message);
      const byPolicy = new Map<string, SlaEscalationStep[]>();
      for (const step of (stepResult.data ?? []) as SlaEscalationStep[]) {
        const list = byPolicy.get(step.policy_id) ?? [];
        list.push(step);
        byPolicy.set(step.policy_id, list);
      }
      return ((policyResult.data ?? []) as SlaPolicy[]).map((policy) => ({
        ...policy,
        steps: byPolicy.get(policy.id) ?? [],
      })) as SlaPolicyWithSteps[];
    }),
});

export interface PolicyInput {
  name: string;
  description?: string | null;
  priority: QueuePriority;
  targetMinutes: number;
  warningPercent: number;
  isDefault: boolean;
  isActive: boolean;
}

export async function createPolicy(input: PolicyInput) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  if (input.isDefault) await clearDefault(input.priority);
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await raw.from("sla_policies").insert({
    company_id: company,
    name: input.name.trim().slice(0, 120),
    description: input.description?.trim() || null,
    priority: input.priority,
    target_minutes: input.targetMinutes,
    warning_percent: input.warningPercent,
    is_default: input.isDefault,
    is_active: input.isActive,
    created_by: auth.user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

async function clearDefault(priority: QueuePriority, exceptId?: string) {
  const company = getActiveTenant();
  let query = raw
    .from("sla_policies")
    .update({ is_default: false })
    .eq("priority", priority)
    .eq("is_default", true);
  if (company) query = query.eq("company_id", company);
  if (exceptId) query = query.neq("id", exceptId);
  await query;
}

export async function updatePolicy(id: string, patch: Partial<PolicyInput>) {
  const company = getActiveTenant();
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name.trim().slice(0, 120);
  if (patch.description !== undefined) body.description = patch.description?.trim() || null;
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.targetMinutes !== undefined) body.target_minutes = patch.targetMinutes;
  if (patch.warningPercent !== undefined) body.warning_percent = patch.warningPercent;
  if (patch.isActive !== undefined) body.is_active = patch.isActive;
  if (patch.isDefault !== undefined) body.is_default = patch.isDefault;
  if (patch.isDefault && patch.priority) await clearDefault(patch.priority, id);
  let query = raw.from("sla_policies").update(body).eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deletePolicy(id: string) {
  const company = getActiveTenant();
  let query = raw.from("sla_policies").delete().eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export interface StepInput {
  policyId: string;
  stepOrder: number;
  delayMinutes: number;
  action: EscalationAction;
  notifyRole?: AppRole | null;
  notifyEmail?: string | null;
  note?: string | null;
}

export async function createStep(input: StepInput) {
  const company = getActiveTenant();
  if (!company) throw new Error("No active workspace.");
  const { error } = await raw.from("sla_escalation_steps").insert({
    company_id: company,
    policy_id: input.policyId,
    step_order: input.stepOrder,
    delay_minutes: input.delayMinutes,
    action: input.action,
    notify_role: input.notifyRole ?? null,
    notify_email: input.notifyEmail?.trim() || null,
    note: input.note?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function updateStep(id: string, patch: Partial<Omit<StepInput, "policyId">>) {
  const company = getActiveTenant();
  const body: Record<string, unknown> = {};
  if (patch.stepOrder !== undefined) body.step_order = patch.stepOrder;
  if (patch.delayMinutes !== undefined) body.delay_minutes = patch.delayMinutes;
  if (patch.action !== undefined) body.action = patch.action;
  if (patch.notifyRole !== undefined) body.notify_role = patch.notifyRole;
  if (patch.notifyEmail !== undefined) body.notify_email = patch.notifyEmail?.trim() || null;
  if (patch.note !== undefined) body.note = patch.note?.trim() || null;
  let query = raw.from("sla_escalation_steps").update(body).eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteStep(id: string) {
  const company = getActiveTenant();
  let query = raw.from("sla_escalation_steps").delete().eq("id", id);
  if (company) query = query.eq("company_id", company);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

/** The active default policy for a priority lane, if the tenant configured one. */
export function policyFor(policies: SlaPolicyWithSteps[] | undefined, priority: QueuePriority) {
  if (!policies) return undefined;
  return policies.find((p) => p.priority === priority && p.is_default && p.is_active);
}

/**
 * The escalation steps a queue item has crossed, given how long ago it
 * breached. Steps are ordered, and each delay is measured from the breach.
 */
export function dueEscalations(
  item: ReviewAssignment,
  policy: SlaPolicyWithSteps | undefined,
  now = Date.now(),
) {
  if (!policy) return [] as SlaEscalationStep[];
  const overdueMinutes = Math.round((now - new Date(item.due_at).getTime()) / 60_000);
  if (overdueMinutes < 0) return [];
  return policy.steps
    .filter((step) => step.is_active && overdueMinutes >= step.delay_minutes)
    .sort((a, b) => a.step_order - b.step_order);
}

/** Warning window in minutes derived from the tenant's configured threshold. */
export function warningMinutes(policy: SlaPolicyWithSteps | undefined, fallbackTarget: number) {
  const target = policy?.target_minutes ?? fallbackTarget;
  const percent = policy?.warning_percent ?? 25;
  return Math.max(5, Math.round((target * percent) / 100));
}
