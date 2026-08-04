import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandFooter } from "@/components/layout/BrandFooter";
import { cn } from "@/lib/utils";
import {
  QUESTIONNAIRE,
  missingRequired,
  type Answers,
  type AnswerValue,
  type Question,
} from "@/features/onboarding/schema";
import {
  APPROVAL_ACTIONS,
  APP_ROLES,
  ROLE_PROFILES,
  newMapping,
  newWorkflow,
  reviewMappings,
  suggestRole,
  type ApprovalWorkflow,
  type AppRoleValue,
  type OrgRoleMapping,
} from "@/features/onboarding/roles";
import { submitQuestionnaire } from "@/features/onboarding/submissions";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Deployment Questionnaire — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Submit your AegisIQ CX pre-sales and deployment questionnaire online: outlets, infrastructure, languages, alerting, compliance, and the roles and approvals your team needs.",
      },
      { property: "og:title", content: "Deployment Questionnaire — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Tell us how your estate runs and we'll configure your AegisIQ CX workspace to match.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingForm,
});

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
}) {
  const label = (
    <Label className="text-sm">
      {question.label}
      {question.required && <span className="ml-1 text-destructive">*</span>}
    </Label>
  );

  return (
    <div className="space-y-1.5">
      {label}
      {question.kind === "text" && (
        <Input
          value={(value as string) ?? ""}
          placeholder={question.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {question.kind === "number" && (
        <Input
          type="number"
          min={0}
          value={value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      )}
      {question.kind === "textarea" && (
        <Textarea rows={3} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
      {question.kind === "select" && (
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(question.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {question.kind === "multiselect" && (
        <div className="flex flex-wrap gap-2">
          {(question.options ?? []).map((option) => {
            const selected = ((value as string[]) ?? []).includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  const current = (value as string[]) ?? [];
                  onChange(selected ? current.filter((o) => o !== option) : [...current, option]);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  selected
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
      {question.kind === "boolean" && (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onChange(Boolean(checked))} />
          <span className="text-sm text-muted-foreground">Yes</span>
        </div>
      )}
      {question.hint && <p className="text-[11px] text-muted-foreground">{question.hint}</p>}
    </div>
  );
}

function RolesStep({
  mappings,
  workflows,
  setMappings,
  setWorkflows,
}: {
  mappings: OrgRoleMapping[];
  workflows: ApprovalWorkflow[];
  setMappings: (next: OrgRoleMapping[]) => void;
  setWorkflows: (next: ApprovalWorkflow[]) => void;
}) {
  const warnings = reviewMappings(mappings);
  const patch = (id: string, changes: Partial<OrgRoleMapping>) =>
    setMappings(mappings.map((m) => (m.id === id ? { ...m, ...changes } : m)));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {mappings.map((m) => (
          <div key={m.id} className="rounded-lg border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Your job title</Label>
                <Input
                  value={m.customerTitle}
                  placeholder="e.g. Area Manager"
                  onChange={(e) =>
                    patch(m.id, {
                      customerTitle: e.target.value,
                      appRole: e.target.value ? suggestRole(e.target.value) : m.appRole,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Platform role</Label>
                <Select value={m.appRole} onValueChange={(v) => patch(m.id, { appRole: v as AppRoleValue })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APP_ROLES.filter((r) => r !== "super_admin").map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_PROFILES[role].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">How many people</Label>
                <Input
                  type="number"
                  min={1}
                  value={m.headcount}
                  onChange={(e) => patch(m.id, { headcount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data scope</Label>
                <Input
                  value={m.scope}
                  placeholder="All outlets / North region / Store 12"
                  onChange={(e) => patch(m.id, { scope: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={m.canExport}
                  onCheckedChange={(checked) => patch(m.id, { canExport: Boolean(checked) })}
                />
                May export data
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={m.canHearAudio}
                  onCheckedChange={(checked) => patch(m.id, { canHearAudio: Boolean(checked) })}
                />
                May listen to raw audio
              </label>
              <span className="text-xs text-muted-foreground">
                {ROLE_PROFILES[m.appRole].capabilities.join(" · ")}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => setMappings(mappings.filter((x) => x.id !== m.id))}
                aria-label="Remove role"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setMappings([...mappings, newMapping()])}>
          <Plus className="size-4" /> Add a role
        </Button>
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-xs text-amber-200">
          {warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      )}

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Approval workflows</h3>
          <p className="text-xs text-muted-foreground">
            Sensitive actions can require a second person to approve. Tell us who signs off on what.
          </p>
        </div>
        {workflows.map((w) => (
          <div key={w.id} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5 xl:col-span-2">
              <Label className="text-xs">Action</Label>
              <Select
                value={w.action}
                onValueChange={(v) => setWorkflows(workflows.map((x) => (x.id === w.id ? { ...x, action: v } : x)))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Requested by</Label>
              <Input
                value={w.requestedBy}
                onChange={(e) =>
                  setWorkflows(workflows.map((x) => (x.id === w.id ? { ...x, requestedBy: e.target.value } : x)))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Approved by</Label>
              <Input
                value={w.approvedBy}
                onChange={(e) =>
                  setWorkflows(workflows.map((x) => (x.id === w.id ? { ...x, approvedBy: e.target.value } : x)))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SLA (hours)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={w.slaHours}
                  onChange={(e) =>
                    setWorkflows(
                      workflows.map((x) => (x.id === w.id ? { ...x, slaHours: Number(e.target.value) } : x)),
                    )
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setWorkflows(workflows.filter((x) => x.id !== w.id))}
                  aria-label="Remove workflow"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setWorkflows([...workflows, newWorkflow()])}>
          <Plus className="size-4" /> Add an approval workflow
        </Button>
      </div>
    </div>
  );
}

function OnboardingForm() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [mappings, setMappings] = useState<OrgRoleMapping[]>([
    newMapping("Head of IT"),
    newMapping("Store Manager"),
  ]);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([newWorkflow()]);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [done, setDone] = useState(false);

  const steps = useMemo(
    () => [
      ...QUESTIONNAIRE.map((s) => ({ id: s.id, title: s.title, description: s.description })),
      {
        id: "roles",
        title: "Roles & permissions",
        description: "Map your org structure onto the platform's authorization model.",
      },
      { id: "review", title: "Contact & submit", description: "Where should we send the kickoff pack?" },
    ],
    [],
  );

  const outstanding = missingRequired(answers);
  const current = steps[step]!;
  const section = QUESTIONNAIRE.find((s) => s.id === current.id);

  const submit = useMutation({
    mutationFn: () =>
      submitQuestionnaire({
        company_name: String(answers["legal_name"] ?? "").trim(),
        contact_name: contact.name.trim(),
        contact_email: contact.email.trim(),
        contact_phone: contact.phone.trim() || undefined,
        answers,
        role_mappings: mappings,
        approval_workflows: workflows,
      }),
    onSuccess: () => setDone(true),
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    String(answers["legal_name"] ?? "").trim().length > 1 &&
    contact.name.trim().length > 1 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email.trim());

  if (done) {
    return (
      <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 pb-20 text-center">
        <CheckCircle2 className="size-12 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold">Thank you — your responses are in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Our team will review your answers and send a kickoff agenda, requirements summary and tailored
          implementation plan to {contact.email}.
        </p>
        <BrandFooter variant="overlay" />
      </main>
    );
  }

  return (
    <main className="relative mx-auto min-h-screen max-w-4xl px-6 pb-24 pt-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-primary">AegisIQ CX™</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
          Pre-sales &amp; deployment questionnaire
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Complete what you can — anything left blank becomes an open item for the kickoff meeting. Your answers
          configure outlets, infrastructure, alerting, compliance and access for your workspace.
        </p>
      </header>

      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Questionnaire steps">
        {steps.map((s, index) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setStep(index)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                index === step
                  ? "border-primary/40 bg-primary/12 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {index + 1}. {s.title}
            </button>
          </li>
        ))}
      </ol>

      <div className="panel p-6">
        <h2 className="text-lg font-semibold">{current.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>

        <div className="mt-6">
          {section && (
            <div className="grid gap-5 md:grid-cols-2">
              {section.questions.map((question) => (
                <div key={question.id} className={question.kind === "textarea" ? "md:col-span-2" : undefined}>
                  <QuestionField
                    question={question}
                    value={answers[question.id]}
                    onChange={(value) => setAnswers((prev) => ({ ...prev, [question.id]: value }))}
                  />
                </div>
              ))}
            </div>
          )}

          {current.id === "roles" && (
            <RolesStep
              mappings={mappings}
              workflows={workflows}
              setMappings={setMappings}
              setWorkflows={setWorkflows}
            />
          )}

          {current.id === "review" && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Your name *</Label>
                  <Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Work email *</Label>
                  <Input
                    type="email"
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Phone</Label>
                  <Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                </div>
              </div>

              {outstanding.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-xs text-amber-200">
                  <p className="font-medium">
                    {outstanding.length} recommended question(s) still blank — they will be raised at kickoff:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {outstanding.slice(0, 8).map((q) => (
                      <li key={q.id}>• {q.label}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                By submitting you agree that AegisIQ CX may use these answers to prepare your deployment plan.
              </p>

              <Button onClick={() => submit.mutate()} disabled={!canSubmit || submit.isPending}>
                <Send className="size-4" />
                {submit.isPending ? "Submitting…" : "Submit questionnaire"}
              </Button>
              {!canSubmit && (
                <p className="text-xs text-muted-foreground">
                  Company legal name (section 1), your name and a valid work email are required to submit.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
          <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <span className="text-xs text-muted-foreground">
            Step {step + 1} of {steps.length}
          </span>
          <Button
            size="sm"
            disabled={step === steps.length - 1}
            onClick={() => setStep((s) => Math.min(s + 1, steps.length - 1))}
          >
            Next <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      <BrandFooter variant="overlay" />
    </main>
  );
}
