import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Highlighter, NotebookPen, Search, SearchX, Tag } from "lucide-react";

import { PageHeader, Panel } from "@/components/common/Primitives";
import { Input } from "@/components/ui/input";
import { Chip, LanguageBadge, RiskBadge, SentimentBadge } from "@/components/conversationiq/Badges";
import { ConversationIqTabs } from "@/components/conversationiq/ModuleTabs";
import {
  iqAlertIndexQuery,
  iqConversationsQuery,
  iqKeywordIndexQuery,
  iqSummaryIndexQuery,
} from "@/features/conversationiq/queries";
import { DEFAULT_FILTERS, applyFilters } from "@/features/conversationiq/filters";
import { reviewSearchQuery } from "@/features/conversationiq/review";
import { outletsQuery } from "@/features/platform/queries";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conversationiq/search")({
  head: () => ({
    meta: [
      { title: "Conversation Search — ConversationIQ™ | AegisIQ CX" },
      {
        name: "description",
        content:
          "Natural-language style search across transcripts, summaries, keywords and conversation metadata.",
      },
      { property: "og:title", content: "Conversation Search — ConversationIQ™" },
      {
        property: "og:description",
        content: "Search every captured customer conversation across your estate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConversationSearchPage,
});

const EXAMPLES = [
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

function ConversationSearchPage() {
  const [term, setTerm] = useState("");

  const conversations = useQuery(iqConversationsQuery);
  const keywordIndex = useQuery(iqKeywordIndexQuery);
  const summaryIndex = useQuery(iqSummaryIndexQuery);
  const alertIndex = useQuery(iqAlertIndexQuery);
  const outlets = useQuery(outletsQuery);
  const reviewHits = useQuery(reviewSearchQuery(term));

  const results = useMemo(() => {
    if (!term.trim()) return [];
    return applyFilters(
      conversations.data ?? [],
      { ...DEFAULT_FILTERS, search: term },
      {
        keywordsByConversation: keywordIndex.data?.byConversation ?? new Map(),
        summaries: summaryIndex.data ?? new Map(),
        alertsByConversation: alertIndex.data ?? new Map(),
      },
    ).slice(0, 100);
  }, [term, conversations.data, keywordIndex.data, summaryIndex.data, alertIndex.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        description="Query transcripts, AI summaries, keywords and metadata across every captured conversation."
      />
      <ConversationIqTabs />

      <div className="panel p-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search conversations using natural language..."
            className="h-16 rounded-xl border-border bg-surface pl-12 text-base"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Examples
          </span>
          {EXAMPLES.map((example) => (
            <button key={example} type="button" onClick={() => setTerm(example)}>
              <Chip tone="neutral">{example}</Chip>
            </button>
          ))}
        </div>
      </div>

      {term.trim().length >= 2 && (
        <Panel
          title={`${formatNumber(reviewHits.data?.length ?? 0)} review matches`}
          description="Full-text search across internal review notes, review tags and saved transcript anchors."
        >
          {reviewHits.isLoading && (
            <p className="text-sm text-muted-foreground">Searching review records…</p>
          )}
          {!reviewHits.isLoading && (reviewHits.data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              No notes, tags or anchors mention “{term}”.
            </p>
          )}
          <ul className="divide-y divide-border/60">
            {(reviewHits.data ?? []).slice(0, 60).map((hit, index) => {
              const conversation = conversations.data?.find((c) => c.id === hit.conversationId);
              const Icon =
                hit.kind === "note" ? NotebookPen : hit.kind === "tag" ? Tag : Highlighter;
              return (
                <li key={`${hit.kind}-${hit.conversationId}-${index}`}>
                  <Link
                    to="/conversationiq/$conversationId"
                    params={{ conversationId: hit.conversationId }}
                    className="block rounded-lg px-2 py-3 transition-colors hover:bg-surface/60"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="info">
                        <Icon className="size-3" /> {hit.kind}
                      </Chip>
                      <span className="font-mono text-xs text-primary">
                        {conversation?.reference ?? "Conversation"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {hit.author ? `${hit.author} · ` : ""}
                        {formatDate(hit.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm">{hit.text}</p>
                    {hit.detail && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {hit.detail}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <Panel
        title={term ? `${formatNumber(results.length)} matches` : "Start searching"}
        description={
          term
            ? "Showing the first 100 matching conversations."
            : "Enter a term or pick an example above to search the conversation corpus."
        }
      >
        {term && results.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <SearchX className="size-6" />
            <p className="text-sm">No conversations match “{term}”.</p>
          </div>
        )}
        <ul className="divide-y divide-border/60">
          {results.map((row) => {
            const summary = summaryIndex.data?.get(row.id);
            const outlet = outlets.data?.find((o) => o.id === row.outlet_id);
            return (
              <li key={row.id}>
                <Link
                  to="/conversationiq/$conversationId"
                  params={{ conversationId: row.id }}
                  className="block rounded-lg px-2 py-3 transition-colors hover:bg-surface/60"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-primary">{row.reference}</span>
                    <span className="text-xs text-muted-foreground">
                      {outlet?.name ?? "—"} · {formatDate(row.started_at)} ·{" "}
                      {formatDuration(row.duration_seconds)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {summary?.summary ?? row.topic ?? "No summary available."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <SentimentBadge value={row.sentiment} />
                    <RiskBadge value={row.risk_level} />
                    <LanguageBadge code={row.language_code} />
                    {(keywordIndex.data?.byConversation.get(row.id) ?? []).slice(0, 4).map((k) => (
                      <Chip key={k.id}>{k.keyword}</Chip>
                    ))}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
