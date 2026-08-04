/**
 * Maps a customer's own org structure onto the platform authorization model.
 *
 * The app authorises through `user_roles` + `has_role()`, so every job title a
 * customer gives us has to resolve to one of the six `app_role` values before
 * provisioning. This module holds that vocabulary plus a suggestion engine so
 * the capture step can pre-fill sensible defaults.
 */

export const APP_ROLES = [
  "super_admin",
  "tenant_admin",
  "regional_manager",
  "outlet_manager",
  "supervisor",
  "viewer",
] as const;

export type AppRoleValue = (typeof APP_ROLES)[number];

export const ROLE_PROFILES: Record<
  AppRoleValue,
  { label: string; summary: string; capabilities: string[] }
> = {
  super_admin: {
    label: "Super admin (AegisIQ)",
    summary: "Platform operator across every tenant. Reserved for AI Algo staff.",
    capabilities: ["Cross-tenant console", "Pricing & metering", "Edge fleet", "All tenant data"],
  },
  tenant_admin: {
    label: "Workspace admin",
    summary: "Owns configuration for the whole company workspace.",
    capabilities: [
      "Administration module",
      "Users, roles & SSO mapping",
      "Quotas & usage governance",
      "All outlets",
    ],
  },
  regional_manager: {
    label: "Regional manager",
    summary: "Oversees a cluster of outlets; benchmarking across their region.",
    capabilities: ["Command Centre", "All outlets in region", "Alert triage", "Exports"],
  },
  outlet_manager: {
    label: "Outlet manager",
    summary: "Accountable for one outlet's CX score and alert response.",
    capabilities: ["Own outlet dashboards", "Alert triage", "Conversation review", "Copilot"],
  },
  supervisor: {
    label: "Supervisor / team lead",
    summary: "Day-to-day floor response and coaching.",
    capabilities: ["Own outlet live monitor", "Acknowledge alerts", "Notes & tags"],
  },
  viewer: {
    label: "Read-only viewer",
    summary: "Executives, auditors and analysts who consume but never change.",
    capabilities: ["Dashboards", "Reports", "No configuration"],
  },
};

export interface OrgRoleMapping {
  id: string;
  customerTitle: string;
  appRole: AppRoleValue;
  headcount: number;
  scope: string;
  canExport: boolean;
  canHearAudio: boolean;
  notes?: string;
}

export interface ApprovalWorkflow {
  id: string;
  action: string;
  requestedBy: string;
  approvedBy: string;
  slaHours: number;
}

export const APPROVAL_ACTIONS = [
  "Grant elevated platform access",
  "Reveal device credentials",
  "Export conversation transcripts",
  "Change alert thresholds or SLAs",
  "Change retention or redaction rules",
  "Increase Copilot quotas",
  "Add or decommission an outlet",
] as const;

const TITLE_HINTS: Array<[RegExp, AppRoleValue]> = [
  [/(cio|cto|coo|ceo|head of it|it director|platform owner|admin)/i, "tenant_admin"],
  [/(region|area|cluster|district|zone)/i, "regional_manager"],
  [/(store manager|outlet manager|branch manager|site manager)/i, "outlet_manager"],
  [/(supervisor|team lead|shift|floor)/i, "supervisor"],
  [/(analyst|auditor|executive|director|finance|read.?only|compliance)/i, "viewer"],
];

/** Best-guess platform role for a free-text job title from the customer. */
export function suggestRole(title: string): AppRoleValue {
  for (const [pattern, role] of TITLE_HINTS) if (pattern.test(title)) return role;
  return "viewer";
}

export function newMapping(customerTitle = ""): OrgRoleMapping {
  return {
    id: crypto.randomUUID(),
    customerTitle,
    appRole: customerTitle ? suggestRole(customerTitle) : "viewer",
    headcount: 1,
    scope: "All outlets",
    canExport: false,
    canHearAudio: false,
  };
}

export function newWorkflow(action = APPROVAL_ACTIONS[0]): ApprovalWorkflow {
  return {
    id: crypto.randomUUID(),
    action,
    requestedBy: "Outlet manager",
    approvedBy: "Workspace admin",
    slaHours: 24,
  };
}

/** Governance warnings surfaced during capture and in the generated plan. */
export function reviewMappings(mappings: OrgRoleMapping[]): string[] {
  const warnings: string[] = [];
  const admins = mappings.filter((m) => m.appRole === "tenant_admin");
  if (!admins.length) warnings.push("No workspace admin nominated — at least one is required to configure the tenant.");
  if (admins.reduce((n, m) => n + m.headcount, 0) > 3)
    warnings.push("More than three workspace admins: consider regional managers instead to limit blast radius.");
  if (mappings.some((m) => m.appRole === "super_admin"))
    warnings.push("Super admin is reserved for AI Algo platform staff and cannot be granted to customer users.");
  if (mappings.some((m) => m.canHearAudio && m.appRole === "viewer"))
    warnings.push("A read-only viewer is set to hear raw audio — confirm this is allowed under your privacy policy.");
  if (!mappings.some((m) => m.canExport))
    warnings.push("Nobody can export data — compliance and executive reporting will be blocked.");
  return warnings;
}
