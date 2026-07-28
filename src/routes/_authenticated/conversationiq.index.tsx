import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { PageHeader } from "@/components/common/Primitives";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/conversationiq/Badges";
import { ConversationTable } from "@/components/conversationiq/ConversationTable";
import { FilterPanel } from "@/components/conversationiq/FilterPanel";
import { ConversationIqTabs } from "@/components/conversationiq/ModuleTabs";
import {
  iqAlertIndexQuery,
  iqConversationsQuery,
  iqKeywordIndexQuery,
  iqSummaryIndexQuery,
} from "@/features/conversationiq/queries";
import { iqTagIndexQuery } from "@/features/conversationiq/review";
import { DEFAULT_FILTERS, applyFilters, type IqFilters } from "@/features/conversationiq/filters";
import { camerasQuery, outletsQuery } from "@/features/platform/queries";
import {
  canViewWidgetQuery,
  widgetFromDeepLink,
} from "@/features/command-centre/widgetAccess";

/** Deep-link contract shared with the Executive Command Centre widgets. */
interface IqSearch {
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

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;
const bool = (value: unknown): boolean | undefined =>
  value === true || value === "true" ? true : undefined;

export const Route = createFileRoute("/_authenticated/conversationiq/")({
  validateSearch: (search: Record<string, unknown>): IqSearch => ({
    dateFrom: str(search.dateFrom),
    dateTo: str(search.dateTo),
    outletId: str(search.outletId),
    language: str(search.language),
    risk: str(search.risk),
    sentiment: str(search.sentiment),
    keyword: str(search.keyword),
    employee: str(search.employee),
    alertStatus: str(search.alertStatus),
    escalatedOnly: bool(search.escalatedOnly),
    complaintsOnly: bool(search.complaintsOnly),
    search: str(search.search),
    from: str(search.from),
  }),
  head: () => ({
    meta: [
      { title: "ConversationIQ™ — Conversation Intelligence | AegisIQ CX" },
      {
        name: "description",
        content:
          "Review, filter and export every captured customer conversation with sentiment, risk and language intelligence.",
      },
      { property: "og:title", content: "ConversationIQ™ — Conversation Intelligence" },
      {
        property: "og:description",
        content: "Enterprise conversation review with sentiment, risk and multilingual detection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConversationListPage,
});

const SEARCH_EXAMPLES = [
  "refund",
  "pricing dispute",
  "customer angry",
  "promotion enquiry",
  "warranty",
  "manager",
  "police",
  "receipt",
  "discount",
  "late delivery",
];

function fromSearch(search: IqSearch): IqFilters {
  return {
    ...DEFAULT_FILTERS,
    dateFrom: search.dateFrom ?? DEFAULT_FILTERS.dateFrom,
    dateTo: search.dateTo ?? DEFAULT_FILTERS.dateTo,
    outletId: search.outletId ?? DEFAULT_FILTERS.outletId,
    language: search.language ?? DEFAULT_FILTERS.language,
    risk: search.risk ?? DEFAULT_FILTERS.risk,
    sentiment: search.sentiment ?? DEFAULT_FILTERS.sentiment,
    keyword: search.keyword ?? DEFAULT_FILTERS.keyword,
    employee: search.employee ?? DEFAULT_FILTERS.employee,
    alertStatus: search.alertStatus ?? DEFAULT_FILTERS.alertStatus,
    escalatedOnly: search.escalatedOnly ?? DEFAULT_FILTERS.escalatedOnly,
    complaintsOnly: search.complaintsOnly ?? DEFAULT_FILTERS.complaintsOnly,
    search: search.search ?? DEFAULT_FILTERS.search,
  };
}

function ConversationListPage() {
  const search = Route.useSearch();
  // Deep links from the Command Centre seed the workbench; the user stays in
  // control of the filters afterwards. The originating widget is re-checked
  // against the database rules, so a restricted widget cannot be drilled into
  // by hand-editing the URL.
  const deepLinkWidget = widgetFromDeepLink(search.from);
  const deepLinkAccess = useQuery(canViewWidgetQuery(deepLinkWidget));
  const blocked = deepLinkWidget !== undefined && deepLinkAccess.data === false;
  const [filters, setFilters] = useState<IqFilters>(() => fromSearch(search));

  useEffect(() => {
    if (blocked) setFilters(DEFAULT_FILTERS);
  }, [blocked]);

  const conversations = useQuery(iqConversationsQuery);
  const keywordIndex = useQuery(iqKeywordIndexQuery);
  const summaryIndex = useQuery(iqSummaryIndexQuery);
  const alertIndex = useQuery(iqAlertIndexQuery);
  const tagIndex = useQuery(iqTagIndexQuery);
  const outlets = useQuery(outletsQuery);
  const cameras = useQuery(camerasQuery);

  const outletMap = useMemo(
    () => new Map((outlets.data ?? []).map((o) => [o.id, o])),
    [outlets.data],
  );
  const cameraMap = useMemo(
    () => new Map((cameras.data ?? []).map((c) => [c.id, c])),
    [cameras.data],
  );

  const employees = useMemo(
    () =>
      Array.from(
        new Set((conversations.data ?? []).map((c) => c.agent_name).filter(Boolean) as string[]),
      ).sort(),
    [conversations.data],
  );

  const tagTerms = useMemo(
    () => Array.from(tagIndex.data?.counts.keys() ?? []).sort(),
    [tagIndex.data],
  );

  const keywordTerms = useMemo(
    () => Array.from(keywordIndex.data?.counts.keys() ?? []).sort(),
    [keywordIndex.data],
  );

  const rows = useMemo(
    () =>
      applyFilters(conversations.data ?? [], filters, {
        keywordsByConversation: keywordIndex.data?.byConversation ?? new Map(),
        summaries: summaryIndex.data ?? new Map(),
        alertsByConversation: alertIndex.data ?? new Map(),
        tagsByConversation: tagIndex.data?.byConversation ?? new Map(),
      }),
    [
      conversations.data,
      filters,
      keywordIndex.data,
      summaryIndex.data,
      alertIndex.data,
      tagIndex.data,
    ],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="ConversationIQ™"
        description="Every captured customer interaction, enriched with sentiment, risk, language and keyword intelligence."
      />
      <ConversationIqTabs />

      <div className="panel p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search conversations using natural language..."
            className="h-14 rounded-xl border-border bg-surface pl-12 text-base"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Try</span>
          {SEARCH_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setFilters({ ...filters, search: example })}
              className="transition-opacity hover:opacity-80"
            >
              <Chip tone="neutral">{example}</Chip>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          outlets={outlets.data ?? []}
          cameras={cameras.data ?? []}
          employees={employees}
          keywords={keywordTerms}
          tags={tagTerms}
        />
        <ConversationTable
          rows={rows}
          outlets={outletMap}
          cameras={cameraMap}
          summaries={summaryIndex.data ?? new Map()}
          alerts={alertIndex.data ?? new Map()}
          tags={tagIndex.data?.byConversation ?? new Map()}
          isLoading={conversations.isLoading}
        />
      </div>
    </div>
  );
}
