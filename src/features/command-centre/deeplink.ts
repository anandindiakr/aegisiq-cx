/**
 * Deep links from Executive Command Centre widgets into ConversationIQ™.
 *
 * Every widget can hand the user across to the conversation workbench with the
 * command centre's active date range and global filters already applied, plus
 * any widget-specific dimension (an outlet, a language, a keyword, a topic…).
 */
import type { CommandFilters } from "./filters";

/** Search-param contract shared with `/conversationiq`. */
export interface IqSearchParams {
  dateFrom?: string;
  dateTo?: string;
  outletId?: string;
  language?: string;
  risk?: string;
  sentiment?: string;
  keyword?: string;
  employee?: string;
  alertStatus?: string;
  escalatedOnly?: boolean;
  complaintsOnly?: boolean;
  search?: string;
  from?: string;
}

export interface DeepLinkContext {
  outletId?: string;
  language?: string;
  keyword?: string;
  topic?: string;
  risk?: string;
  sentiment?: string;
  employee?: string;
  alertStatus?: string;
  escalatedOnly?: boolean;
  complaintsOnly?: boolean;
}

function isoDay(value: string): string | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function clean(params: IqSearchParams): IqSearchParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== false),
  ) as IqSearchParams;
}

/**
 * Builds the ConversationIQ search payload for a widget.
 *
 * Command centre filters are multi-select while ConversationIQ is single-value
 * per dimension, so the first selected value is carried across and the widget
 * context always wins over the global selection.
 */
export function toIqSearch(
  filters: CommandFilters,
  context: DeepLinkContext = {},
  widgetId?: string,
): IqSearchParams {
  return clean({
    dateFrom: isoDay(filters.from),
    dateTo: isoDay(filters.to),
    outletId: context.outletId ?? filters.outlets[0],
    language: context.language ?? filters.languages[0],
    risk: context.risk ?? filters.risks[0],
    sentiment: context.sentiment,
    keyword: context.keyword ?? filters.keywords[0],
    employee: context.employee ?? filters.employees[0],
    alertStatus: context.alertStatus,
    escalatedOnly: context.escalatedOnly,
    complaintsOnly: context.complaintsOnly,
    search: context.topic ?? filters.topics[0],
    from: widgetId ? `command-centre:${widgetId}` : "command-centre",
  });
}

/** Widget-specific dimension applied on top of the global filters. */
export const WIDGET_DEEP_LINK: Record<string, DeepLinkContext> = {
  kpis: {},
  summary: {},
  score: {},
  sentiment: { sentiment: "negative" },
  outlets: {},
  map: {},
  languages: {},
  keywords: {},
  alerts: { alertStatus: "open" },
  issues: { complaintsOnly: true },
  regions: {},
  recommendations: { escalatedOnly: true },
  insights: {},
  activity: {},
};
