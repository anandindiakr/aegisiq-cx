/**
 * Turns a submitted questionnaire into the kickoff pack: meeting agenda,
 * requirements summary, implementation plan and tenant configuration
 * checklist. Everything is generated client-side as Markdown/CSV so an
 * account manager can download and share it immediately.
 */

import { QUESTIONNAIRE, formatAnswer, type Answers } from "./schema";
import { ROLE_PROFILES, reviewMappings, type ApprovalWorkflow, type OrgRoleMapping } from "./roles";
import type { OnboardingSubmission } from "./submissions";

const num = (answers: Answers, id: string, fallback = 0) => {
  const value = Number(answers[id]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

function today() {
  return new Date().toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "customer";
}

/* ---------------------------------------------------------------- agenda */

export function kickoffAgenda(s: OnboardingSubmission): string {
  const a = s.answers;
  const outlets = num(a, "outlet_count", 1);
  const cameras = outlets * num(a, "cameras_per_outlet", 0);
  const lines: string[] = [
    `# Kickoff Meeting Agenda — ${s.company_name}`,
    "",
    `**Prepared:** ${today()}  `,
    `**Attendees (customer):** ${s.contact_name} (${s.contact_email})  `,
    `**Attendees (AegisIQ CX):** Account lead, solutions architect, deployment engineer  `,
    `**Duration:** 90 minutes`,
    "",
    "## 1. Welcome & objectives (10 min)",
    `- Confirm success criteria: ${formatAnswer(a["success_metrics"])}`,
    `- Confirm pilot go-live target: ${formatAnswer(a["pilot_date"])}`,
    "",
    "## 2. Scope confirmation (15 min)",
    `- ${outlets} outlet(s), ${cameras || "TBC"} camera(s), ${formatAnswer(a["audio_capture"])} audio point(s) per outlet`,
    `- Regions / clusters: ${formatAnswer(a["regions"])}`,
    `- Rollout approach: ${formatAnswer(a["rollout_style"])}`,
    "",
    "## 3. Identity, users & approvals (15 min)",
    `- Sign-in method: ${formatAnswer(a["sso"])} for ${formatAnswer(a["email_domains"])}`,
    ...s.role_mappings.map(
      (m) => `- ${m.customerTitle || "(untitled)"} → **${ROLE_PROFILES[m.appRole].label}** (${m.headcount} user(s), ${m.scope})`,
    ),
    ...s.approval_workflows.map(
      (w) => `- Approval: ${w.action} — ${w.requestedBy} requests, ${w.approvedBy} approves within ${w.slaHours}h`,
    ),
    "",
    "## 4. Infrastructure & network walkthrough (20 min)",
    `- Edge hosting: ${formatAnswer(a["edge_hosting"])}`,
    `- Camera estate: ${formatAnswer(a["camera_brands"])}`,
    `- Network profile: ${formatAnswer(a["network"])}`,
    `- Retention: ${formatAnswer(a["retention_days"])} days; residency: ${formatAnswer(a["residency"])}`,
    "",
    "## 5. CX model, keywords & alerting (15 min)",
    `- Languages: ${formatAnswer(a["languages"])}`,
    `- Priority keywords: ${formatAnswer(a["keywords"])}`,
    `- Critical events: ${formatAnswer(a["critical_events"])}`,
    `- SLA: acknowledge ${formatAnswer(a["ack_sla"])} min, resolve ${formatAnswer(a["resolve_sla"])} min`,
    `- Channels: ${formatAnswer(a["channels"])}`,
    "",
    "## 6. Privacy, security & compliance (10 min)",
    `- Regulations: ${formatAnswer(a["regulations"])}`,
    `- Consent approach: ${formatAnswer(a["consent"])}`,
    `- Redaction: ${formatAnswer(a["redaction"])}`,
    "",
    "## 7. Plan, owners & next steps (5 min)",
    "- Agree milestone dates and named owners",
    "- Confirm outstanding items listed in the requirements summary",
    "",
    "---",
    "Confidential · Powered by AI Algo (S) Pte Ltd.",
  ];
  return lines.join("\n");
}

/* ----------------------------------------------- requirements summary */

export function requirementsSummary(s: OnboardingSubmission): string {
  const lines: string[] = [
    `# Requirements Summary — ${s.company_name}`,
    "",
    `**Contact:** ${s.contact_name} · ${s.contact_email}${s.contact_phone ? ` · ${s.contact_phone}` : ""}  `,
    `**Submitted:** ${new Date(s.created_at).toLocaleString("en-SG")}  `,
    `**Status:** ${s.status}`,
    "",
  ];

  for (const section of QUESTIONNAIRE) {
    lines.push(`## ${section.title}`, "", "| Requirement | Response |", "| --- | --- |");
    for (const q of section.questions) {
      lines.push(`| ${q.label} | ${formatAnswer(s.answers[q.id]).replace(/\n/g, " ")} |`);
    }
    lines.push("");
  }

  lines.push("## Roles & permissions", "", "| Customer role | Platform role | Users | Scope | Export | Raw audio |", "| --- | --- | --- | --- | --- | --- |");
  for (const m of s.role_mappings) {
    lines.push(
      `| ${m.customerTitle} | ${ROLE_PROFILES[m.appRole].label} | ${m.headcount} | ${m.scope} | ${m.canExport ? "Yes" : "No"} | ${m.canHearAudio ? "Yes" : "No"} |`,
    );
  }
  lines.push("", "## Approval workflows", "", "| Action | Requested by | Approved by | SLA |", "| --- | --- | --- | --- |");
  for (const w of s.approval_workflows) {
    lines.push(`| ${w.action} | ${w.requestedBy} | ${w.approvedBy} | ${w.slaHours}h |`);
  }

  const warnings = reviewMappings(s.role_mappings);
  if (warnings.length) {
    lines.push("", "## Governance follow-ups", "", ...warnings.map((w) => `- ${w}`));
  }

  const open = QUESTIONNAIRE.flatMap((sec) => sec.questions)
    .filter((q) => formatAnswer(s.answers[q.id]) === "—")
    .map((q) => q.label);
  if (open.length) {
    lines.push("", "## Open items to confirm at kickoff", "", ...open.map((label) => `- ${label}`));
  }

  lines.push("", "---", "Confidential · Powered by AI Algo (S) Pte Ltd.");
  return lines.join("\n");
}

/* ------------------------------------------------ implementation plan */

export interface PlanPhase {
  name: string;
  window: string;
  owner: string;
  tasks: string[];
}

export function implementationPlan(s: OnboardingSubmission): PlanPhase[] {
  const a = s.answers;
  const outlets = num(a, "outlet_count", 1);
  const phased = String(a["rollout_style"] ?? "").toLowerCase().includes("phased") || outlets > 10;
  const ssoNeeded = !String(a["sso"] ?? "").startsWith("Email");
  const integrations = (a["systems"] as string[] | undefined)?.filter((x) => x !== "None yet") ?? [];

  const phases: PlanPhase[] = [
    {
      name: "Phase 1 — Kickoff & workspace provisioning",
      window: "Week 1",
      owner: "AegisIQ account lead",
      tasks: [
        "Run kickoff meeting and sign off the requirements summary",
        `Create the tenant workspace for ${s.company_name} (${formatAnswer(a["currency"])} billing)`,
        `Load the outlet register (${outlets} outlet(s)) and region grouping`,
        "Create user accounts and apply the agreed role mappings",
        ...(ssoNeeded ? [`Configure ${formatAnswer(a["sso"])} SSO and claim-to-role mapping for ${formatAnswer(a["email_domains"])}`] : []),
      ],
    },
    {
      name: "Phase 2 — Infrastructure onboarding",
      window: phased ? "Weeks 2-4" : "Week 2",
      owner: "Deployment engineer + customer IT",
      tasks: [
        `Install / register edge gateways (${formatAnswer(a["edge_hosting"])})`,
        `Register ${outlets * num(a, "cameras_per_outlet", 0) || "the"} camera stream(s) and store device credentials encrypted`,
        `Commission ${formatAnswer(a["audio_capture"])} audio capture point(s) per outlet`,
        "Open firewall rules and validate bandwidth against the network profile",
        "Run the Test Centre diagnostics and set device health thresholds",
      ],
    },
    {
      name: "Phase 3 — Intelligence configuration",
      window: phased ? "Weeks 4-5" : "Week 3",
      owner: "Solutions architect",
      tasks: [
        `Enable speech engines for ${formatAnswer(a["languages"])}`,
        "Load the keyword and prohibited-phrase libraries",
        `Tune the CX score model (${formatAnswer(a["cx_weighting"]) === "—" ? "default weighting" : formatAnswer(a["cx_weighting"])})`,
        `Create alert rules for: ${formatAnswer(a["critical_events"])}`,
        `Set SLA timers (${formatAnswer(a["ack_sla"])} min acknowledge / ${formatAnswer(a["resolve_sla"])} min resolve) and escalation chain`,
        `Configure notification channels: ${formatAnswer(a["channels"])}`,
      ],
    },
    {
      name: "Phase 4 — Governance & compliance",
      window: phased ? "Week 5" : "Week 3",
      owner: "Compliance lead + workspace admin",
      tasks: [
        `Apply retention of ${formatAnswer(a["retention_days"])} days and residency rules`,
        `Configure transcript redaction: ${formatAnswer(a["redaction"])}`,
        "Publish approval workflows for elevated access and exports",
        `Confirm consent signage and process: ${formatAnswer(a["consent"])}`,
        ...(a["security_review"] ? ["Deliver security review pack and pen-test evidence"] : []),
        "Set Copilot quotas and usage alert thresholds",
      ],
    },
    {
      name: "Phase 5 — Pilot, validation & training",
      window: phased ? "Weeks 6-7" : "Week 4",
      owner: "AegisIQ CS + outlet managers",
      tasks: [
        "Run a 2-week supervised pilot with daily accuracy review",
        "Calibrate keyword precision and alert noise with outlet managers",
        "Train each role group against its permission set",
        `Stand up the executive reporting cadence: ${formatAnswer(a["reporting"])}`,
      ],
    },
    {
      name: "Phase 6 — Rollout & hypercare",
      window: phased ? "Weeks 8+" : "Week 5",
      owner: "AegisIQ delivery manager",
      tasks: [
        phased ? "Roll out region by region against the agreed sequence" : "Roll out remaining outlets",
        "30-day hypercare with weekly health and usage reviews",
        `Benchmark against success criteria: ${formatAnswer(a["success_metrics"])}`,
        ...(integrations.length ? [`Deliver integrations: ${integrations.join(", ")}`] : []),
        "Handover to steady-state support",
      ],
    },
  ];

  return phases;
}

export function implementationPlanMarkdown(s: OnboardingSubmission): string {
  const lines = [`# Implementation Plan — ${s.company_name}`, "", `Generated ${today()} from the submitted questionnaire.`, ""];
  for (const phase of implementationPlan(s)) {
    lines.push(`## ${phase.name}`, "", `**Window:** ${phase.window}  `, `**Owner:** ${phase.owner}`, "");
    lines.push(...phase.tasks.map((t) => `- [ ] ${t}`), "");
  }
  lines.push("---", "Confidential · Powered by AI Algo (S) Pte Ltd.");
  return lines.join("\n");
}

/* --------------------------------------------- configuration checklist */

export interface ChecklistItem {
  area: string;
  item: string;
  value: string;
  module: string;
}

export function configChecklist(s: OnboardingSubmission): ChecklistItem[] {
  const a = s.answers;
  const items: ChecklistItem[] = [
    { area: "Workspace", item: "Company profile & branding", value: s.company_name, module: "Administration → General" },
    { area: "Workspace", item: "Billing currency", value: formatAnswer(a["currency"]), module: "Platform → Pricing" },
    { area: "Estate", item: "Outlets created", value: formatAnswer(a["outlet_count"]), module: "Outlets" },
    { area: "Estate", item: "Region grouping", value: formatAnswer(a["regions"]), module: "Outlets" },
    { area: "Estate", item: "Operating hours / time zone", value: formatAnswer(a["operating_hours"]), module: "Administration → General" },
    { area: "Identity", item: "Sign-in method", value: formatAnswer(a["sso"]), module: "Administration → Security" },
    { area: "Identity", item: "Email domains", value: formatAnswer(a["email_domains"]), module: "Administration → Security" },
    { area: "Infrastructure", item: "Cameras per outlet", value: formatAnswer(a["cameras_per_outlet"]), module: "Infrastructure → Cameras" },
    { area: "Infrastructure", item: "Edge hosting model", value: formatAnswer(a["edge_hosting"]), module: "Infrastructure → Gateways" },
    { area: "Infrastructure", item: "Audio capture points", value: formatAnswer(a["audio_capture"]), module: "Infrastructure → Audio" },
    { area: "Infrastructure", item: "Storage retention (days)", value: formatAnswer(a["retention_days"]), module: "Infrastructure → Storage" },
    { area: "Intelligence", item: "Languages enabled", value: formatAnswer(a["languages"]), module: "Administration → Languages" },
    { area: "Intelligence", item: "Keyword library", value: formatAnswer(a["keywords"]), module: "Administration → Keywords" },
    { area: "Intelligence", item: "Prohibited phrases", value: formatAnswer(a["banned_phrases"]), module: "Administration → Keywords" },
    { area: "Alerting", item: "Critical alert rules", value: formatAnswer(a["critical_events"]), module: "Administration → Alerts" },
    { area: "Alerting", item: "Acknowledge SLA (min)", value: formatAnswer(a["ack_sla"]), module: "ConversationIQ → SLA Policies" },
    { area: "Alerting", item: "Resolve SLA (min)", value: formatAnswer(a["resolve_sla"]), module: "ConversationIQ → SLA Policies" },
    { area: "Alerting", item: "Notification channels", value: formatAnswer(a["channels"]), module: "Notifications" },
    { area: "Compliance", item: "Regulations in scope", value: formatAnswer(a["regulations"]), module: "Administration → Security" },
    { area: "Compliance", item: "Redaction rules", value: formatAnswer(a["redaction"]), module: "ConversationIQ → Redactions" },
    { area: "Compliance", item: "Data residency", value: formatAnswer(a["residency"]), module: "Administration → Backup" },
    { area: "Copilot", item: "Copilot users", value: formatAnswer(a["copilot_users"]), module: "Administration → Quotas" },
    { area: "Copilot", item: "Queries per outlet / month", value: formatAnswer(a["copilot_queries"]), module: "Administration → Quotas" },
    { area: "Reporting", item: "Executive reporting cadence", value: formatAnswer(a["reporting"]), module: "Copilot → Report Templates" },
  ];

  for (const m of s.role_mappings) {
    items.push({
      area: "Access",
      item: `${m.customerTitle || "Role"} → ${ROLE_PROFILES[m.appRole].label}`,
      value: `${m.headcount} user(s) · ${m.scope} · export ${m.canExport ? "yes" : "no"} · audio ${m.canHearAudio ? "yes" : "no"}`,
      module: "Roles & Access",
    });
  }
  for (const w of s.approval_workflows) {
    items.push({
      area: "Access",
      item: `Approval: ${w.action}`,
      value: `${w.requestedBy} → ${w.approvedBy} within ${w.slaHours}h`,
      module: "Roles & Access",
    });
  }
  return items;
}

export function checklistCsv(s: OnboardingSubmission): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""').replace(/\n/g, " ")}"`;
  const rows = [
    ["Area", "Checklist item", "Customer requirement", "Where to configure", "Done"],
    ...configChecklist(s).map((i) => [i.area, i.item, i.value, i.module, ""]),
  ];
  return rows.map((r) => r.map((c) => esc(String(c))).join(",")).join("\n");
}

/* --------------------------------------------------------- downloading */

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadKickoffPack(s: OnboardingSubmission) {
  const base = slug(s.company_name);
  download(`${base}-kickoff-agenda.md`, kickoffAgenda(s), "text/markdown");
  download(`${base}-requirements-summary.md`, requirementsSummary(s), "text/markdown");
  download(`${base}-implementation-plan.md`, implementationPlanMarkdown(s), "text/markdown");
  download(`${base}-configuration-checklist.csv`, checklistCsv(s), "text/csv");
}

export const fileBase = slug;
