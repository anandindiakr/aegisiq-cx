/**
 * Executive Command Centre — shared contracts.
 *
 * Every widget consumes this shape. The payload is produced by the
 * `public.executive_overview(jsonb)` database function so the browser never
 * downloads raw conversation rows: aggregation happens next to the data and
 * row-level security is applied as the signed-in user.
 */

export interface ExecutiveKpis {
  total: number;
  total_prev: number;
  positive: number;
  positive_prev: number;
  negative: number;
  negative_prev: number;
  avg_sentiment: number;
  avg_sentiment_prev: number;
  avg_duration: number;
  avg_duration_prev: number;
  complaints: number;
  complaints_prev: number;
  refunds: number;
  refunds_prev: number;
  warranty: number;
  warranty_prev: number;
  escalations: number;
  escalations_prev: number;
  alerts: number;
  active_outlets: number;
  total_outlets: number;
  online_cameras: number;
  total_cameras: number;
}

export interface SentimentPeriod {
  ord: number;
  key: "today" | "yesterday" | "week" | "month";
  label: string;
  very_positive: number;
  positive: number;
  neutral: number;
  negative: number;
  very_negative: number;
  avg_sentiment: number;
  total: number;
}

export interface OutletPerformance {
  id: string;
  name: string;
  code: string;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  conversations: number;
  avg_sentiment: number;
  avg_duration: number;
  negatives: number;
  positives: number;
  escalations: number;
  complaint_rate: number;
  positive_rate: number;
  risk_score: number;
  overall_score: number;
}

export interface RegionPerformance {
  region: string;
  conversations: number;
  positives: number;
  negatives: number;
  avg_duration: number;
  avg_sentiment: number;
  escalations: number;
}

export interface LanguageMix {
  code: string;
  name: string;
  conversations: number;
  avg_sentiment: number;
  prev_count: number;
}

export interface KeywordMention {
  term: string;
  mentions: number;
  avg_sentiment: number;
}

export interface IssueRow {
  label: string;
  occurrences: number;
  avg_sentiment: number;
  prev_count: number;
}

export interface DailyPoint {
  day: string;
  conversations: number;
  avg_sentiment: number;
  negatives: number;
}

export interface HourlyPoint {
  hour: number;
  conversations: number;
  avg_sentiment: number;
}

export interface RecentAlert {
  id: string;
  conversation_id: string | null;
  outlet_id: string | null;
  outlet_name: string | null;
  title: string;
  category: string | null;
  severity: string;
  status: string;
  triggered_at: string;
}

export interface ActivityItem {
  id: string;
  kind: "conversation" | "alert";
  title: string;
  detail: string;
  outlet_name: string | null;
  tone: string;
  at: string;
  conversation_id: string | null;
}

export interface ExecutiveFilterOptions {
  regions: string[];
  outlets: { id: string; name: string; region: string | null }[];
  languages: { code: string; name: string }[];
  topics: string[];
  employees: string[];
  keywords: string[];
  alertTypes: string[];
}

export interface ExecutiveOverview {
  generatedAt: string;
  range: { from: string; to: string };
  kpis: ExecutiveKpis;
  sentimentPeriods: SentimentPeriod[];
  outlets: OutletPerformance[];
  regions: RegionPerformance[];
  languages: LanguageMix[];
  keywords: KeywordMention[];
  issues: IssueRow[];
  daily: DailyPoint[];
  hourly: HourlyPoint[];
  alertsBySeverity: Record<string, number>;
  alertsByCategory: Record<string, number>;
  recentAlerts: RecentAlert[];
  activity: ActivityItem[];
  filterOptions: ExecutiveFilterOptions;
}

export type OutletHealth = "healthy" | "attention" | "critical";

export function outletHealth(outlet: OutletPerformance): OutletHealth {
  if (outlet.conversations === 0) return "attention";
  if (outlet.risk_score >= 45 || outlet.overall_score < 40) return "critical";
  if (outlet.risk_score >= 28 || outlet.overall_score < 58) return "attention";
  return "healthy";
}
