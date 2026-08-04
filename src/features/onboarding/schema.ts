/**
 * Shared definition of the AegisIQ CX pre-sales / deployment questionnaire.
 *
 * The same schema drives the public web form, the admin review screen and the
 * generated kickoff pack, so a question only ever has to be authored once.
 */

export type FieldKind = "text" | "textarea" | "number" | "select" | "multiselect" | "boolean";

export interface Question {
  id: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  hint?: string;
  required?: boolean;
  placeholder?: string;
}

export interface Section {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

export type AnswerValue = string | number | boolean | string[] | undefined;
export type Answers = Record<string, AnswerValue>;

export const QUESTIONNAIRE: Section[] = [
  {
    id: "company",
    title: "Company & commercial profile",
    description: "Sizes the workspace, licences and billing.",
    questions: [
      { id: "legal_name", label: "Legal company name", kind: "text", required: true },
      { id: "trading_name", label: "Trading / brand name shown to staff", kind: "text" },
      { id: "country", label: "Country of operation", kind: "text", required: true },
      {
        id: "industry",
        label: "Industry / segment",
        kind: "select",
        options: [
          "Grocery & convenience",
          "Fashion & apparel",
          "F&B / QSR",
          "Electronics",
          "Pharmacy",
          "Banking branch",
          "Telco retail",
          "Other",
        ],
        required: true,
      },
      {
        id: "currency",
        label: "Preferred billing currency",
        kind: "select",
        options: ["SGD", "USD", "MYR", "AUD", "EUR", "GBP", "INR"],
        required: true,
      },
      { id: "outlet_count", label: "Total outlets / sites in scope", kind: "number", required: true },
      {
        id: "rollout_style",
        label: "Rollout approach",
        kind: "select",
        options: ["Pilot (1-5 sites)", "Phased by region", "Full rollout"],
        required: true,
      },
      { id: "pilot_date", label: "Target go-live date for the pilot", kind: "text", placeholder: "e.g. 15 Sep 2026" },
      { id: "rollout_date", label: "Target date for full rollout", kind: "text" },
      { id: "named_users", label: "Expected number of named platform users", kind: "number" },
      {
        id: "procurement",
        label: "Procurement / legal steps before signature",
        kind: "textarea",
        hint: "MSA, DPA, security review, insurance certificates…",
      },
    ],
  },
  {
    id: "outlets",
    title: "Outlet & site inventory",
    description: "Each outlet becomes a tenant-scoped entity with its own KPIs, quotas and alert routing.",
    questions: [
      { id: "regions", label: "Regions / clusters used to group outlets", kind: "textarea", required: true },
      { id: "outlet_codes", label: "Do outlets already have store codes we should reuse?", kind: "boolean" },
      { id: "outlet_sizes", label: "Typical outlet size and daily footfall", kind: "textarea" },
      { id: "operating_hours", label: "Operating hours and time zone(s)", kind: "text", required: true },
      { id: "peak_periods", label: "Peak trading periods to watch", kind: "textarea" },
      { id: "outlet_upload", label: "Can you provide an outlet list (CSV) at kickoff?", kind: "boolean" },
    ],
  },
  {
    id: "infrastructure",
    title: "Audio, camera & edge infrastructure",
    description: "Determines edge gateway sizing, stream ingestion and health thresholds.",
    questions: [
      { id: "cameras_per_outlet", label: "Cameras per outlet (average)", kind: "number", required: true },
      {
        id: "camera_brands",
        label: "Camera makes / models in the estate",
        kind: "textarea",
        hint: "ONVIF support and RTSP availability matter most.",
      },
      { id: "audio_capture", label: "Audio capture points per outlet", kind: "number", required: true },
      {
        id: "audio_source",
        label: "Audio source",
        kind: "multiselect",
        options: ["Camera-integrated mics", "Standalone ceiling mics", "Counter mics", "Headsets", "Drive-through"],
      },
      { id: "network", label: "Site network profile (bandwidth, VLANs, firewall rules)", kind: "textarea" },
      {
        id: "edge_hosting",
        label: "Edge compute preference",
        kind: "select",
        options: ["AegisIQ-supplied edge gateway", "Customer-supplied hardware", "Cloud-only ingestion"],
      },
      { id: "retention_days", label: "Required media / transcript retention (days)", kind: "number", required: true },
      { id: "storage_pref", label: "Storage location constraints (in-country, region)", kind: "text" },
    ],
  },
  {
    id: "language",
    title: "Language, speech & CX scoring",
    description: "Configures speech engines, keyword libraries and the CX score model.",
    questions: [
      {
        id: "languages",
        label: "Languages spoken in-store",
        kind: "multiselect",
        options: ["English", "Mandarin", "Malay", "Tamil", "Hindi", "Cantonese", "Bahasa Indonesia", "Thai", "Vietnamese", "Other"],
        required: true,
      },
      { id: "dialects", label: "Dialects, code-switching or accents we should tune for", kind: "textarea" },
      { id: "cx_drivers", label: "What defines a great customer interaction for you?", kind: "textarea", required: true },
      { id: "cx_weighting", label: "Preferred CX score weighting (sentiment / resolution / compliance)", kind: "text" },
      { id: "keywords", label: "Priority keywords and phrases to detect", kind: "textarea", required: true },
      { id: "banned_phrases", label: "Prohibited phrases or scripts that must never be used", kind: "textarea" },
      { id: "scripts", label: "Mandatory greetings / upsell scripts to verify", kind: "textarea" },
    ],
  },
  {
    id: "alerts",
    title: "Alerts, SLAs & escalation",
    description: "Drives alert rules, SLA timers and escalation chains.",
    questions: [
      { id: "critical_events", label: "Events that must raise a critical alert", kind: "textarea", required: true },
      { id: "ack_sla", label: "Acknowledgement SLA for critical alerts (minutes)", kind: "number", required: true },
      { id: "resolve_sla", label: "Resolution SLA for critical alerts (minutes)", kind: "number", required: true },
      {
        id: "channels",
        label: "Notification channels",
        kind: "multiselect",
        options: ["In-app", "Email", "Slack", "Microsoft Teams", "SMS", "Webhook"],
        required: true,
      },
      { id: "escalation_chain", label: "Escalation chain when an SLA breaches", kind: "textarea" },
      { id: "quiet_hours", label: "Quiet hours or do-not-disturb windows", kind: "text" },
    ],
  },
  {
    id: "compliance",
    title: "Privacy, security & compliance",
    description: "Sets redaction rules, retention and the security review evidence we must provide.",
    questions: [
      {
        id: "regulations",
        label: "Applicable regulations",
        kind: "multiselect",
        options: ["PDPA (SG)", "GDPR", "CCPA", "PCI-DSS", "HIPAA", "Local labour law", "Other"],
        required: true,
      },
      { id: "consent", label: "How is customer/staff consent for recording obtained?", kind: "textarea", required: true },
      { id: "redaction", label: "Data that must be redacted from transcripts", kind: "textarea" },
      { id: "dpo", label: "Data protection officer / privacy contact", kind: "text" },
      { id: "security_review", label: "Security questionnaire or pen-test evidence required?", kind: "boolean" },
      { id: "residency", label: "Data residency requirement", kind: "text" },
    ],
  },
  {
    id: "integrations",
    title: "Integrations & Copilot",
    description: "Confirms external systems, identity provider and AI usage budgets.",
    questions: [
      {
        id: "sso",
        label: "Preferred sign-in method",
        kind: "select",
        options: ["Email + password", "Google Workspace", "Microsoft Entra ID", "Okta", "Other SAML/OIDC IdP"],
        required: true,
      },
      { id: "email_domains", label: "Email domain(s) your staff use", kind: "text", required: true },
      {
        id: "systems",
        label: "Systems to integrate",
        kind: "multiselect",
        options: ["POS", "CRM", "Workforce management", "Ticketing / ITSM", "BI warehouse", "None yet"],
      },
      { id: "reporting", label: "Reports and cadence executives expect", kind: "textarea", required: true },
      { id: "copilot_users", label: "How many people will use Aegis Copilot?", kind: "number" },
      { id: "copilot_queries", label: "Expected Copilot queries per outlet per month", kind: "number" },
      { id: "success_metrics", label: "How will you judge the deployment a success?", kind: "textarea", required: true },
    ],
  },
];

export const SECTION_BY_ID = Object.fromEntries(QUESTIONNAIRE.map((s) => [s.id, s]));

export function allQuestions(): Question[] {
  return QUESTIONNAIRE.flatMap((section) => section.questions);
}

export function questionLabel(id: string) {
  return allQuestions().find((q) => q.id === id)?.label ?? id;
}

export function formatAnswer(value: AnswerValue): string {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Required questions the respondent has not answered yet. */
export function missingRequired(answers: Answers): Question[] {
  return allQuestions().filter((q) => {
    if (!q.required) return false;
    const value = answers[q.id];
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === "" || value === null;
  });
}
