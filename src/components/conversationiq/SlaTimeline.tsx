import { AlertTriangle, CheckCircle2, Clock, Flag, Siren } from "lucide-react";

import { Chip } from "@/components/conversationiq/Badges";
import { formatDateTime } from "@/lib/format";
import type { ReviewAssignment } from "@/features/conversationiq/queue";
import {
  ESCALATION_ACTION_LABELS,
  warningMinutes,
  type SlaPolicyWithSteps,
} from "@/features/conversationiq/slaPolicies";
import { ROLE_LABELS } from "@/features/auth/useSession";

type Tone = "done" | "active" | "breach" | "pending";

interface Milestone {
  key: string;
  label: string;
  detail: string;
  at: number | null;
  tone: Tone;
  icon: typeof Clock;
}

const TONE_CLASS: Record<Tone, string> = {
  done: "border-positive/40 bg-positive/10 text-positive",
  active: "border-primary/50 bg-primary/10 text-primary",
  breach: "border-destructive/40 bg-destructive/10 text-destructive",
  pending: "border-border bg-muted/30 text-muted-foreground",
};

function relative(at: number, now: number) {
  const minutes = Math.round((at - now) / 60_000);
  const abs = Math.abs(minutes);
  const span =
    abs >= 1440 ? `${Math.round(abs / 1440)}d` : abs >= 60 ? `${Math.round(abs / 60)}h` : `${abs}m`;
  if (minutes === 0) return "now";
  return minutes > 0 ? `in ${span}` : `${span} ago`;
}

/**
 * End-to-end SLA history for a single queue item: when it started, when the
 * warning threshold hits, when the target expires, and every configured
 * escalation step with whether it has already fired.
 */
export function SlaTimeline({
  item,
  policy,
  now = Date.now(),
}: {
  item: ReviewAssignment;
  policy?: SlaPolicyWithSteps;
  now?: number;
}) {
  const due = new Date(item.due_at).getTime();
  const completed = item.completed_at ? new Date(item.completed_at).getTime() : null;
  const settled = item.status === "done" || item.status === "cancelled";
  const clock = completed ?? now;
  const warnAt = due - warningMinutes(policy, item.sla_minutes) * 60_000;

  const milestones: Milestone[] = [
    {
      key: "created",
      label: "Item created",
      detail: policy
        ? `${policy.name} · ${policy.target_minutes}m target`
        : `${item.sla_minutes}m default target`,
      at: new Date(item.created_at).getTime(),
      tone: "done",
      icon: Flag,
    },
  ];

  if (item.started_at) {
    milestones.push({
      key: "started",
      label: "Review started",
      detail: item.assignee_name ?? "Unassigned",
      at: new Date(item.started_at).getTime(),
      tone: "done",
      icon: Clock,
    });
  }

  milestones.push({
    key: "warning",
    label: "Warning threshold",
    detail: policy ? `${policy.warning_percent}% of target elapsed` : "25% of target remaining",
    at: warnAt,
    tone: clock >= warnAt ? (clock >= due ? "done" : "active") : "pending",
    icon: AlertTriangle,
  });

  milestones.push({
    key: "due",
    label: "SLA target",
    detail:
      settled && completed
        ? completed <= due
          ? "Met before the deadline"
          : "Missed — closed after the deadline"
        : clock >= due
          ? "Breached"
          : "Deadline",
    at: due,
    tone: clock >= due ? (settled ? "done" : "breach") : "pending",
    icon: Siren,
  });

  const steps = (policy?.steps ?? [])
    .filter((step) => step.is_active)
    .sort((a, b) => a.step_order - b.step_order);

  for (const step of steps) {
    const at = due + step.delay_minutes * 60_000;
    const fired = !settled && clock >= at;
    milestones.push({
      key: step.id,
      label: `Escalation ${step.step_order} · ${ESCALATION_ACTION_LABELS[step.action]}`,
      detail: [
        step.notify_role ? (ROLE_LABELS[step.notify_role] ?? step.notify_role) : null,
        step.notify_email,
        step.note,
        `+${step.delay_minutes}m after breach`,
      ]
        .filter(Boolean)
        .join(" · "),
      at,
      tone: fired ? "breach" : settled ? "done" : "pending",
      icon: Siren,
    });
  }

  if (completed) {
    milestones.push({
      key: "completed",
      label: item.status === "cancelled" ? "Cancelled" : "Completed",
      detail: item.assignee_name ?? "Unassigned",
      at: completed,
      tone: "done",
      icon: CheckCircle2,
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={settled ? "positive" : clock >= due ? "negative" : "info"}>
          {settled ? "Closed" : clock >= due ? "Breached" : "Within SLA"}
        </Chip>
        <span className="text-xs text-muted-foreground">
          {policy
            ? `Policy: ${policy.name}`
            : "No policy configured for this lane — using the item's own target."}
        </span>
      </div>

      <ol className="relative space-y-3 border-l border-border/60 pl-5">
        {milestones.map((milestone) => {
          const Icon = milestone.icon;
          return (
            <li key={milestone.key} className="relative">
              <span
                className={`absolute -left-[27px] flex size-5 items-center justify-center rounded-full border ${
                  TONE_CLASS[milestone.tone]
                }`}
              >
                <Icon className="size-3" />
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{milestone.label}</p>
                <p className="text-xs text-muted-foreground">
                  {milestone.at ? formatDateTime(new Date(milestone.at).toISOString()) : "—"}
                  {milestone.at && !settled ? ` · ${relative(milestone.at, now)}` : ""}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{milestone.detail}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
