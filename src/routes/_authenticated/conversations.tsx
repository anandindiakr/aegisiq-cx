import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { conversationsQuery, outletsQuery } from "@/features/platform/queries";
import { formatDateTime, formatDuration, formatNumber, LANGUAGE_NAMES } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conversations")({
  head: () => ({
    meta: [
      { title: "ConversationIQ™ — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Search, filter and review every captured customer conversation with sentiment, language and outlet context.",
      },
      { property: "og:title", content: "ConversationIQ™ — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Searchable customer conversation intelligence across your estate.",
      },
    ],
  }),
  component: ConversationsPage,
});

function sentimentTone(score: number) {
  if (score <= -0.2) return "negative" as const;
  if (score >= 0.2) return "positive" as const;
  return "info" as const;
}

function ConversationsPage() {
  const { data, isPending, error, refetch } = useQuery(conversationsQuery);
  const outlets = useQuery(outletsQuery);
  const [term, setTerm] = useState("");
  const [outlet, setOutlet] = useState("all");
  const [language, setLanguage] = useState("all");
  const [limit, setLimit] = useState(50);

  const outletName = useMemo(() => {
    const map = new Map((outlets.data ?? []).map((o) => [o.id, o.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Unassigned") : "Unassigned");
  }, [outlets.data]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (data ?? []).filter((c) => {
      if (outlet !== "all" && c.outlet_id !== outlet) return false;
      if (language !== "all" && c.language_code !== language) return false;
      if (!q) return true;
      return (
        c.reference.toLowerCase().includes(q) ||
        (c.topic ?? "").toLowerCase().includes(q) ||
        (c.agent_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, term, outlet, language]);

  return (
    <div>
      <PageHeader
        title="ConversationIQ™"
        description="Every captured interaction, enriched with sentiment, intent, language and outlet attribution."
        actions={
          <Button variant="outline" size="sm">
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
        }
      />

      <Panel
        title={`${formatNumber(filtered.length)} conversations`}
        description="Filtered view of the last 1,000 captured interactions"
      >
        <div className="mb-5 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search reference, topic or agent"
              className="bg-surface pl-9"
              maxLength={80}
            />
          </div>
          <Select value={outlet} onValueChange={setOutlet}>
            <SelectTrigger className="w-full bg-surface md:w-56">
              <SelectValue placeholder="Outlet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outlets</SelectItem>
              {(outlets.data ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-full bg-surface md:w-44">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isPending ? (
          <LoadingState rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No conversations match these filters"
            description="Try widening the outlet or language filter, or clear the search term."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Reference</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Captured</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, limit).map((c) => (
                    <TableRow key={c.id} className="border-border">
                      <TableCell className="font-mono text-xs">{c.reference}</TableCell>
                      <TableCell className="text-xs">{outletName(c.outlet_id)}</TableCell>
                      <TableCell className="text-xs">{c.topic}</TableCell>
                      <TableCell className="text-xs">{c.agent_name}</TableCell>
                      <TableCell className="text-xs">
                        {LANGUAGE_NAMES[c.language_code] ?? c.language_code}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {formatDuration(c.duration_seconds)}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          label={Number(c.sentiment_score).toFixed(2)}
                          tone={sentimentTone(Number(c.sentiment_score))}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(c.started_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {limit < filtered.length && (
              <div className="mt-5 flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 50)}>
                  Load 50 more
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
