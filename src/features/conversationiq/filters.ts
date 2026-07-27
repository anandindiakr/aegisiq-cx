import type {
  IqConversation,
  IqDetectedKeyword,
  IqSummary,
} from "@/features/conversationiq/queries";
import type { AlertRow } from "@/features/platform/queries";

export interface IqFilters {
  dateFrom: string;
  dateTo: string;
  outletId: string;
  cameraId: string;
  language: string;
  sentiment: string;
  risk: string;
  keyword: string;
  employee: string;
  minDuration: number;
  maxDuration: number;
  alertStatus: string;
  complaintsOnly: boolean;
  escalatedOnly: boolean;
  search: string;
}

export const DEFAULT_FILTERS: IqFilters = {
  dateFrom: "",
  dateTo: "",
  outletId: "all",
  cameraId: "all",
  language: "all",
  sentiment: "all",
  risk: "all",
  keyword: "all",
  employee: "all",
  minDuration: 0,
  maxDuration: 3600,
  alertStatus: "all",
  complaintsOnly: false,
  escalatedOnly: false,
  search: "",
};

export function activeFilterCount(filters: IqFilters) {
  let count = 0;
  if (filters.dateFrom) count++;
  if (filters.dateTo) count++;
  for (const key of [
    "outletId",
    "cameraId",
    "language",
    "sentiment",
    "risk",
    "keyword",
    "employee",
    "alertStatus",
  ] as const) {
    if (filters[key] !== "all") count++;
  }
  if (filters.minDuration > 0 || filters.maxDuration < 3600) count++;
  if (filters.complaintsOnly) count++;
  if (filters.escalatedOnly) count++;
  return count;
}

const COMPLAINT_CATEGORIES = new Set(["Complaint", "Service", "Aggressive Behaviour"]);

export interface FilterContext {
  keywordsByConversation: Map<string, IqDetectedKeyword[]>;
  summaries: Map<string, IqSummary>;
  alertsByConversation: Map<string, AlertRow[]>;
}

/**
 * Pure, testable filter pass over the loaded conversation window. Keeping this
 * outside the components means the list page, the search page and any future
 * saved-view feature all evaluate filters identically.
 */
export function applyFilters(
  rows: IqConversation[],
  filters: IqFilters,
  ctx: FilterContext,
): IqConversation[] {
  const term = filters.search.trim().toLowerCase();
  const fromTime = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
  const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;

  return rows.filter((row) => {
    const started = new Date(row.started_at).getTime();
    if (fromTime !== null && started < fromTime) return false;
    if (toTime !== null && started > toTime) return false;
    if (filters.outletId !== "all" && row.outlet_id !== filters.outletId) return false;
    if (filters.cameraId !== "all" && row.camera_id !== filters.cameraId) return false;
    if (filters.language !== "all" && row.language_code !== filters.language) return false;
    if (filters.sentiment !== "all" && row.sentiment !== filters.sentiment) return false;
    if (filters.risk !== "all" && row.risk_level !== filters.risk) return false;
    if (filters.employee !== "all" && row.agent_name !== filters.employee) return false;
    if (row.duration_seconds < filters.minDuration) return false;
    if (filters.maxDuration < 3600 && row.duration_seconds > filters.maxDuration) return false;
    if (filters.escalatedOnly && !row.escalated) return false;

    const keywords = ctx.keywordsByConversation.get(row.id) ?? [];
    if (filters.keyword !== "all" && !keywords.some((k) => k.keyword === filters.keyword)) {
      return false;
    }
    if (filters.complaintsOnly && !keywords.some((k) => COMPLAINT_CATEGORIES.has(k.category))) {
      return false;
    }

    if (filters.alertStatus !== "all") {
      const alerts = ctx.alertsByConversation.get(row.id) ?? [];
      if (
        filters.alertStatus === "none"
          ? alerts.length > 0
          : !alerts.some((a) => a.status === filters.alertStatus)
      ) {
        return false;
      }
    }

    if (term) {
      const summary = ctx.summaries.get(row.id);
      const haystack = [
        row.reference,
        row.topic ?? "",
        row.agent_name ?? "",
        row.customer_type ?? "",
        summary?.summary ?? "",
        summary?.intent ?? "",
        ...keywords.map((k) => `${k.keyword} ${k.category}`),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    return true;
  });
}
