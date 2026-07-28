/**
 * Aegis Copilot™ command catalogue.
 *
 * Quick actions and executive commands are the curated surface of the
 * resolver: every entry here maps to a phrase the engine understands, so the
 * cards in the library and the typed/spoken input share one code path.
 */
import type { CopilotIntent } from "./types";

export interface CopilotCommandCard {
  id: string;
  label: string;
  description: string;
  phrase: string;
  intent: CopilotIntent;
  /** Icon key resolved in the UI layer, keeps this module render-free. */
  icon:
    | "report"
    | "alerts"
    | "regions"
    | "export"
    | "outlets"
    | "sentiment"
    | "language"
    | "keywords"
    | "queue"
    | "conversations"
    | "dashboard";
  group: "executive" | "operations";
}

export const EXECUTIVE_COMMANDS: CopilotCommandCard[] = [
  {
    id: "generate-executive-report",
    label: "Generate Executive Report",
    description: "Board-ready briefing across CX score, sentiment and risk.",
    phrase: "Generate executive report",
    intent: "executive_report",
    icon: "report",
    group: "executive",
  },
  {
    id: "export-report",
    label: "Export Report",
    description: "Download the current board pack as PDF, Excel or CSV.",
    phrase: "Export report as PDF",
    intent: "export_report",
    icon: "export",
    group: "executive",
  },
  {
    id: "open-alerts",
    label: "Open Alerts",
    description: "Jump into the live alert stream, highest severity first.",
    phrase: "Open alerts",
    intent: "open_alerts",
    icon: "alerts",
    group: "operations",
  },
  {
    id: "compare-regions",
    label: "Compare Regions",
    description: "Rank every region by sentiment, escalations and volume.",
    phrase: "Compare regions",
    intent: "compare_regions",
    icon: "regions",
    group: "executive",
  },
  {
    id: "outlet-ranking",
    label: "Outlet Ranking",
    description: "Best and worst performing outlets in the active window.",
    phrase: "Show outlet ranking",
    intent: "outlet_ranking",
    icon: "outlets",
    group: "executive",
  },
  {
    id: "sentiment-overview",
    label: "Sentiment Overview",
    description: "Today versus yesterday, week and month sentiment mix.",
    phrase: "Show sentiment overview",
    intent: "sentiment_overview",
    icon: "sentiment",
    group: "executive",
  },
  {
    id: "language-mix",
    label: "Language Analytics",
    description: "Language distribution and sentiment per language.",
    phrase: "Show language analytics",
    intent: "language_mix",
    icon: "language",
    group: "operations",
  },
  {
    id: "top-keywords",
    label: "Top Keywords",
    description: "Most mentioned terms and the sentiment attached to them.",
    phrase: "Show top keywords",
    intent: "top_keywords",
    icon: "keywords",
    group: "operations",
  },
  {
    id: "open-queue",
    label: "Reviewer Queue",
    description: "Open the ConversationIQ review queue and SLA board.",
    phrase: "Open reviewer queue",
    intent: "open_queue",
    icon: "queue",
    group: "operations",
  },
  {
    id: "open-conversations",
    label: "Open ConversationIQ",
    description: "Browse conversations with your default filters applied.",
    phrase: "Open conversations",
    intent: "open_conversations",
    icon: "conversations",
    group: "operations",
  },
];

/** Context actions offered when the copilot is opened on a conversation. */
export const CONVERSATION_COMMANDS: CopilotCommandCard[] = [
  {
    id: "summarise-conversation",
    label: "Summarise",
    description: "Condense this conversation into an executive summary.",
    phrase: "Summarise this conversation",
    intent: "summarise_conversation",
    icon: "report",
    group: "operations",
  },
  {
    id: "translate-conversation",
    label: "Translate",
    description: "Translate the transcript into English.",
    phrase: "Translate this conversation to English",
    intent: "translate_conversation",
    icon: "language",
    group: "operations",
  },
  {
    id: "explain-sentiment",
    label: "Explain sentiment",
    description: "Why this conversation scored the way it did.",
    phrase: "Explain the sentiment of this conversation",
    intent: "explain_sentiment",
    icon: "sentiment",
    group: "operations",
  },
  {
    id: "related-conversations",
    label: "Related conversations",
    description: "Similar conversations at the same outlet or topic.",
    phrase: "Show related conversations",
    intent: "related_conversations",
    icon: "conversations",
    group: "operations",
  },
];

export interface RoadmapCapability {
  label: string;
  description: string;
}

export const ROADMAP: RoadmapCapability[] = [
  { label: "Live coaching", description: "Real-time nudges to floor staff during a conversation." },
  { label: "Predictive churn", description: "Flag customers likely to disengage before they do." },
  {
    label: "Autonomous actions",
    description: "Let the copilot resolve low-risk cases end to end.",
  },
];

export const DASHBOARD_TARGETS: { key: string; label: string; to: string }[] = [
  { key: "command-centre", label: "Executive Command Centre", to: "/command-centre" },
  { key: "dashboard", label: "Operations Dashboard", to: "/dashboard" },
  { key: "conversationiq", label: "ConversationIQ", to: "/conversationiq" },
  { key: "queue", label: "Reviewer Queue", to: "/conversationiq/queue" },
  { key: "alerts", label: "Alerts", to: "/alerts" },
  { key: "reports", label: "Reports", to: "/reports" },
];
