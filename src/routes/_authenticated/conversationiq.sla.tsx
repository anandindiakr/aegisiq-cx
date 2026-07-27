import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownWideNarrow, Plus, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/common/Primitives";
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
import { Chip } from "@/components/conversationiq/Badges";
import { ConversationIqTabs } from "@/components/conversationiq/ModuleTabs";
import { useIqAccess } from "@/features/conversationiq/access";
import {
  QUEUE_PRIORITIES,
  reviewQueueQuery,
  type QueuePriority,
} from "@/features/conversationiq/queue";
import {
  ESCALATION_ACTIONS,
  ESCALATION_ACTION_LABELS,
  createPolicy,
  createStep,
  deletePolicy,
  deleteStep,
  dueEscalations,
  policyFor,
  slaPoliciesQuery,
  updatePolicy,
  updateStep,
  warningMinutes,
  type EscalationAction,
  type SlaPolicyWithSteps,
} from "@/features/conversationiq/slaPolicies";
import { ROLE_LABELS } from "@/features/auth/useSession";
import type { AppRole } from "@/features/platform/queries";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conversationiq/sla")({
  head: () => ({
    meta: [
      { title: "SLA Policies — ConversationIQ™ | AegisIQ CX" },
      {
        name: "description",
        content:
          "Configure reviewer queue SLA thresholds per priority with rule-based escalation steps and escalation delays.",
      },
      { property: "og:title", content: "SLA Policies — ConversationIQ™" },
      {
        property: "og:description",
        content: "Queue-level service targets, warning thresholds and escalation chains.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SlaPolicyPage,
});

const NOTIFY_ROLES: AppRole[] = [
  "supervisor",
  "outlet_manager",
  "regional_manager",
  "tenant_admin",
];

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function SlaPolicyPage() {
  const queryClient = useQueryClient();
  const access = useIqAccess();
  const canManage = access.can("manageSla");
  const policies = useQuery(slaPoliciesQuery);
  const queue = useQuery(reviewQueueQuery);

  const [name, setName] = useState("");
  const [priority, setPriority] = useState<QueuePriority>("normal");
  const [target, setTarget] = useState("240");
  const [warning, setWarning] = useState("25");
  const [isDefault, setIsDefault] = useState(true);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: slaPoliciesQuery.queryKey });
  };

  const addPolicy = useMutation({
    mutationFn: () =>
      createPolicy({
        name: name.trim(),
        priority,
        targetMinutes: Math.max(5, Number(target) || 240),
        warningPercent: Math.min(90, Math.max(5, Number(warning) || 25)),
        isDefault,
        isActive: true,
      }),
    onSuccess: () => {
      toast.success("SLA policy created");
      setName("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patchPolicy = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof updatePolicy>[1] }) =>
      updatePolicy(input.id, input.patch),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const removePolicy = useMutation({
    mutationFn: (id: string) => deletePolicy(id),
    onSuccess: () => {
      toast.success("Policy removed");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addStep = useMutation({
    mutationFn: (policy: SlaPolicyWithSteps) =>
      createStep({
        policyId: policy.id,
        stepOrder: (policy.steps.at(-1)?.step_order ?? 0) + 1,
        delayMinutes: (policy.steps.at(-1)?.delay_minutes ?? 0) + 30,
        action: "escalate",
        notifyRole: "outlet_manager",
      }),
    onSuccess: () => {
      toast.success("Escalation step added");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patchStep = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof updateStep>[1] }) =>
      updateStep(input.id, input.patch),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const removeStep = useMutation({
    mutationFn: (id: string) => deleteStep(id),
    onSuccess: () => {
      toast.success("Step removed");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /** Live impact: how many active queue items already crossed each step. */
  const impact = useMemo(() => {
    const items = (queue.data ?? []).filter(
      (item) => item.status === "open" || item.status === "in_progress",
    );
    const map = new Map<string, number>();
    for (const item of items) {
      const policy = policyFor(policies.data, item.priority);
      for (const step of dueEscalations(item, policy)) {
        map.set(step.id, (map.get(step.id) ?? 0) + 1);
      }
    }
    return map;
  }, [queue.data, policies.data]);

  const list = policies.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="SLA Policies"
        description="Service targets per reviewer queue, with rule-based escalation steps and the delay before each step fires."
      />
      <ConversationIqTabs />

      {canManage && (
        <Panel
          title="New policy"
          description="One default policy per priority lane drives due dates, warnings and escalations."
        >
          <div className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-2">
              <Label className="text-xs">Policy name</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Fraud escalation"
                className="mt-1.5 h-9 bg-surface"
              />
            </div>
            <div>
              <Label className="text-xs">Queue priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as QueuePriority)}
              >
                <SelectTrigger className="mt-1.5 h-9 bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUEUE_PRIORITIES.map((item) => (
                    <SelectItem key={item} value={item} className="capitalize">
                      {item.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Target (minutes)</Label>
              <Input
                type="number"
                min={5}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="mt-1.5 h-9 bg-surface"
              />
            </div>
            <div>
              <Label className="text-xs">Warn at (% of target left)</Label>
              <Input
                type="number"
                min={5}
                max={90}
                value={warning}
                onChange={(event) => setWarning(event.target.value)}
                className="mt-1.5 h-9 bg-surface"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              Make this the default policy for the {priority} queue
            </label>
            <Button
              size="sm"
              disabled={!name.trim() || addPolicy.isPending}
              onClick={() => addPolicy.mutate()}
            >
              <Plus className="mr-1.5 size-4" /> Create policy
            </Button>
          </div>
        </Panel>
      )}

      {policies.isPending && <LoadingState rows={4} />}
      {policies.error && (
        <ErrorState
          message={(policies.error as Error).message}
          onRetry={() => void policies.refetch()}
        />
      )}
      {!policies.isPending && list.length === 0 && (
        <EmptyState
          title="No SLA policies yet"
          description="Create a policy per priority lane so the reviewer queue knows when work is late and who to escalate to."
        />
      )}

      <div className="grid gap-4">
        {list.map((policy) => (
          <Panel
            key={policy.id}
            title={policy.name}
            description={`${policy.priority.toUpperCase()} queue · target ${durationLabel(
              policy.target_minutes,
            )} · warns ${durationLabel(warningMinutes(policy, policy.target_minutes))} before breach`}
            actions={
              <div className="flex items-center gap-2">
                {policy.is_default && <Chip tone="info">Default</Chip>}
                <Chip tone={policy.is_active ? "positive" : "neutral"}>
                  {policy.is_active ? "Active" : "Paused"}
                </Chip>
                {canManage && (
                  <>
                    <Switch
                      checked={policy.is_active}
                      onCheckedChange={(checked) =>
                        patchPolicy.mutate({ id: policy.id, patch: { isActive: checked } })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      title="Delete policy"
                      onClick={() => removePolicy.mutate(policy.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
            }
          >
            {canManage && (
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">Target minutes</Label>
                  <Input
                    type="number"
                    min={5}
                    defaultValue={policy.target_minutes}
                    className="mt-1.5 h-9 bg-surface"
                    onBlur={(event) => {
                      const value = Math.max(
                        5,
                        Number(event.target.value) || policy.target_minutes,
                      );
                      if (value !== policy.target_minutes) {
                        patchPolicy.mutate({ id: policy.id, patch: { targetMinutes: value } });
                      }
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Warning threshold (%)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={90}
                    defaultValue={policy.warning_percent}
                    className="mt-1.5 h-9 bg-surface"
                    onBlur={(event) => {
                      const value = Math.min(
                        90,
                        Math.max(5, Number(event.target.value) || policy.warning_percent),
                      );
                      if (value !== policy.warning_percent) {
                        patchPolicy.mutate({ id: policy.id, patch: { warningPercent: value } });
                      }
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
                    <Switch
                      checked={policy.is_default}
                      onCheckedChange={(checked) =>
                        patchPolicy.mutate({
                          id: policy.id,
                          patch: { isDefault: checked, priority: policy.priority },
                        })
                      }
                    />
                    Default for this queue
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <ArrowDownWideNarrow className="size-3.5" /> Escalation chain
              </p>
              {policy.steps.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  No escalation steps — breaches notify the assignee only.
                </p>
              )}
              {policy.steps.map((step) => (
                <div
                  key={step.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2"
                >
                  <Chip tone="neutral">Step {step.step_order}</Chip>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Timer className="size-3" />
                    {step.delay_minutes === 0
                      ? "at breach"
                      : `${durationLabel(step.delay_minutes)} after breach`}
                  </span>
                  {canManage ? (
                    <>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={step.delay_minutes}
                        className="h-8 w-24 bg-surface"
                        onBlur={(event) => {
                          const value = Math.max(0, Number(event.target.value) || 0);
                          if (value !== step.delay_minutes) {
                            patchStep.mutate({ id: step.id, patch: { delayMinutes: value } });
                          }
                        }}
                      />
                      <Select
                        value={step.action}
                        onValueChange={(value) =>
                          patchStep.mutate({
                            id: step.id,
                            patch: { action: value as EscalationAction },
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-36 bg-surface">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ESCALATION_ACTIONS.map((action) => (
                            <SelectItem key={action} value={action}>
                              {ESCALATION_ACTION_LABELS[action]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={step.notify_role ?? "none"}
                        onValueChange={(value) =>
                          patchStep.mutate({
                            id: step.id,
                            patch: { notifyRole: value === "none" ? null : (value as AppRole) },
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-44 bg-surface">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No role notified</SelectItem>
                          {NOTIFY_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role] ?? role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        defaultValue={step.notify_email ?? ""}
                        placeholder="Optional email"
                        className="h-8 w-52 bg-surface"
                        onBlur={(event) => {
                          if (event.target.value !== (step.notify_email ?? "")) {
                            patchStep.mutate({
                              id: step.id,
                              patch: { notifyEmail: event.target.value },
                            });
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title="Remove step"
                        onClick={() => removeStep.mutate(step.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Chip tone="info">{ESCALATION_ACTION_LABELS[step.action]}</Chip>
                      <span className="text-xs text-muted-foreground">
                        {step.notify_role
                          ? (ROLE_LABELS[step.notify_role] ?? step.notify_role)
                          : "—"}
                        {step.notify_email ? ` · ${step.notify_email}` : ""}
                      </span>
                    </>
                  )}
                  {(impact.get(step.id) ?? 0) > 0 && (
                    <Chip tone="negative">
                      {formatNumber(impact.get(step.id) ?? 0)} item(s) past this step
                    </Chip>
                  )}
                </div>
              ))}
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => addStep.mutate(policy)}>
                  <Plus className="mr-1.5 size-3.5" /> Add escalation step
                </Button>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
