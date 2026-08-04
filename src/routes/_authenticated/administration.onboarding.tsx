import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, ClipboardList, Download, FileText, ListChecks, Trash2 } from "lucide-react";

import { EmptyState, ErrorState, LoadingState, Panel, StatusPill } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { QUESTIONNAIRE, formatAnswer } from "@/features/onboarding/schema";
import { ROLE_PROFILES, reviewMappings } from "@/features/onboarding/roles";
import {
  SUBMISSION_STATUSES,
  deleteSubmission,
  submissionsQuery,
  updateSubmission,
  type OnboardingSubmission,
} from "@/features/onboarding/submissions";
import {
  checklistCsv,
  configChecklist,
  download,
  downloadKickoffPack,
  fileBase,
  implementationPlan,
  implementationPlanMarkdown,
  kickoffAgenda,
  requirementsSummary,
} from "@/features/onboarding/documents";

export const Route = createFileRoute("/_authenticated/administration/onboarding")({
  head: () => ({
    meta: [
      { title: "Customer Onboarding — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Review submitted deployment questionnaires and generate the kickoff agenda, requirements summary, implementation plan and tenant configuration checklist.",
      },
      { property: "og:title", content: "Customer Onboarding — AegisIQ CX™" },
      {
        property: "og:description",
        content: "From questionnaire responses to a tailored implementation plan in one click.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingReview,
});

function Detail({ submission }: { submission: OnboardingSubmission }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(submission.internal_notes ?? "");
  const base = fileBase(submission.company_name);
  const warnings = reviewMappings(submission.role_mappings);
  const phases = implementationPlan(submission);
  const checklist = configChecklist(submission);

  const save = useMutation({
    mutationFn: (patch: { status?: string; internal_notes?: string }) =>
      updateSubmission(submission.id, patch),
    onSuccess: () => {
      toast.success("Submission updated");
      void queryClient.invalidateQueries({ queryKey: ["onboarding-submissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteSubmission(submission.id),
    onSuccess: () => {
      toast.success("Submission removed");
      void queryClient.invalidateQueries({ queryKey: ["onboarding-submissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Panel
        title={submission.company_name}
        description={`${submission.contact_name} · ${submission.contact_email}${
          submission.contact_phone ? ` · ${submission.contact_phone}` : ""
        } · submitted ${new Date(submission.created_at).toLocaleString("en-SG")}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={submission.status} onValueChange={(status) => save.mutate({ status })}>
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBMISSION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => downloadKickoffPack(submission)}>
              <Download className="size-4" /> Download kickoff pack
            </Button>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate()} aria-label="Delete submission">
              <Trash2 className="size-4" />
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => download(`${base}-kickoff-agenda.md`, kickoffAgenda(submission), "text/markdown")}
          >
            <CalendarCheck className="size-4" /> Kickoff agenda
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              download(`${base}-requirements-summary.md`, requirementsSummary(submission), "text/markdown")
            }
          >
            <FileText className="size-4" /> Requirements summary
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              download(`${base}-implementation-plan.md`, implementationPlanMarkdown(submission), "text/markdown")
            }
          >
            <ClipboardList className="size-4" /> Implementation plan
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => download(`${base}-configuration-checklist.csv`, checklistCsv(submission), "text/csv")}
          >
            <ListChecks className="size-4" /> Configuration checklist (CSV)
          </Button>
        </div>
      </Panel>

      <Panel title="Roles & permissions mapping" description="How the customer's org structure maps to platform roles">
        {submission.role_mappings.length ? (
          <div className="space-y-2">
            {submission.role_mappings.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {m.customerTitle || "Untitled role"} → {ROLE_PROFILES[m.appRole].label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.headcount} user(s) · {m.scope} · export {m.canExport ? "yes" : "no"} · raw audio{" "}
                    {m.canHearAudio ? "yes" : "no"}
                  </p>
                </div>
                <StatusPill label={m.appRole.replace("_", " ")} tone="neutral" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No roles captured" description="The customer skipped the roles step." />
        )}

        {submission.approval_workflows.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Approval workflows
            </p>
            {submission.approval_workflows.map((w) => (
              <p key={w.id} className="text-sm text-muted-foreground">
                {w.action} — {w.requestedBy} requests, {w.approvedBy} approves within {w.slaHours}h
              </p>
            ))}
          </div>
        )}

        {warnings.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-xs text-amber-200">
            {warnings.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Tailored implementation plan" description="Generated from the submitted responses">
        <ol className="space-y-4">
          {phases.map((phase) => (
            <li key={phase.name} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{phase.name}</p>
                <p className="text-xs text-muted-foreground">
                  {phase.window} · {phase.owner}
                </p>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {phase.tasks.map((task) => (
                  <li key={task}>• {task}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Tenant configuration checklist" description="Every setting to apply, and where to apply it">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <th className="py-2 pr-3">Area</th>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Customer requirement</th>
                <th className="py-2">Configure in</th>
              </tr>
            </thead>
            <tbody>
              {checklist.map((item, index) => (
                <tr key={`${item.item}-${index}`} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3 text-muted-foreground">{item.area}</td>
                  <td className="py-2 pr-3">{item.item}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{item.value}</td>
                  <td className="py-2 text-muted-foreground">{item.module}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Questionnaire responses" description="Everything the customer told us">
        <div className="space-y-5">
          {QUESTIONNAIRE.map((section) => (
            <div key={section.id}>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {section.title}
              </p>
              <dl className="mt-2 space-y-1.5">
                {section.questions.map((q) => (
                  <div key={q.id} className="flex flex-wrap justify-between gap-3 text-sm">
                    <dt className="text-muted-foreground">{q.label}</dt>
                    <dd className="max-w-[55%] text-right">{formatAnswer(submission.answers[q.id])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Internal notes" description="Visible to workspace admins only">
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="mt-3" size="sm" onClick={() => save.mutate({ internal_notes: notes })}>
          Save notes
        </Button>
      </Panel>
    </div>
  );
}

function OnboardingReview() {
  const submissions = useQuery(submissionsQuery);
  const [selected, setSelected] = useState<string | undefined>();

  if (submissions.isPending) return <LoadingState rows={5} />;
  if (submissions.isError) {
    return <ErrorState message={(submissions.error as Error).message} onRetry={() => void submissions.refetch()} />;
  }

  const rows = submissions.data ?? [];
  const active = rows.find((r) => r.id === selected) ?? rows[0];

  return (
    <div className="space-y-6">
      <Panel
        title="Submitted questionnaires"
        description="Customers can complete the questionnaire online at /onboarding — no download required."
        actions={
          <Button size="sm" variant="outline" asChild>
            <a href="/onboarding" target="_blank" rel="noreferrer">
              Open public form
            </a>
          </Button>
        }
      >
        {rows.length ? (
          <div className="space-y-2">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelected(row.id)}
                className={cn(
                  "flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                  active?.id === row.id
                    ? "border-primary/35 bg-primary/8"
                    : "border-border hover:bg-muted/40",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.company_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.contact_name} · {row.contact_email} ·{" "}
                    {new Date(row.created_at).toLocaleDateString("en-SG")}
                  </p>
                </div>
                <StatusPill
                  label={row.status.replace("_", " ")}
                  tone={row.status === "configured" ? "positive" : row.status === "archived" ? "neutral" : "warning"}
                />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No submissions yet"
            description="Share the public questionnaire link with your customer to collect their responses."
          />
        )}
      </Panel>

      {active && <Detail key={active.id} submission={active} />}
    </div>
  );
}
