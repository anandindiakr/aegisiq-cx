import { useMemo, useState } from "react";
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
import { DEFAULT_FILTERS, applyFilters, type IqFilters } from "@/features/conversationiq/filters";
import { camerasQuery, outletsQuery } from "@/features/platform/queries";

export const Route = createFileRoute("/_authenticated/conversationiq/")({
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

function ConversationListPage() {
  const [filters, setFilters] = useState<IqFilters>(DEFAULT_FILTERS);

  const conversations = useQuery(iqConversationsQuery);
  const keywordIndex = useQuery(iqKeywordIndexQuery);
  const summaryIndex = useQuery(iqSummaryIndexQuery);
  const alertIndex = useQuery(iqAlertIndexQuery);
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
      }),
    [conversations.data, filters, keywordIndex.data, summaryIndex.data, alertIndex.data],
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
        />
        <ConversationTable
          rows={rows}
          outlets={outletMap}
          cameras={cameraMap}
          summaries={summaryIndex.data ?? new Map()}
          alerts={alertIndex.data ?? new Map()}
          isLoading={conversations.isLoading}
        />
      </div>
    </div>
  );
}
