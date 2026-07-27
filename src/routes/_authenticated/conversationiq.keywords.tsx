import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, Panel } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Chip } from "@/components/conversationiq/Badges";
import { ConversationIqTabs } from "@/components/conversationiq/ModuleTabs";
import {
  KEYWORD_CATEGORIES,
  createKeyword,
  deleteKeyword,
  iqKeywordIndexQuery,
  setKeywordActive,
} from "@/features/conversationiq/queries";
import { keywordsQuery } from "@/features/platform/queries";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conversationiq/keywords")({
  head: () => ({
    meta: [
      { title: "Keyword Library — ConversationIQ™ | AegisIQ CX" },
      {
        name: "description",
        content:
          "Manage the tenant keyword library used to detect complaints, refunds, fraud and escalation signals.",
      },
      { property: "og:title", content: "Keyword Library — ConversationIQ™" },
      {
        property: "og:description",
        content: "Enterprise keyword governance for conversation intelligence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KeywordsPage,
});

function KeywordsPage() {
  const queryClient = useQueryClient();
  const keywords = useQuery(keywordsQuery);
  const detections = useQuery(iqKeywordIndexQuery);

  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<string>("Custom");
  const [weight, setWeight] = useState("0.7");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["platform", "keywords"] });
    void queryClient.invalidateQueries({ queryKey: keywordsQuery.queryKey });
  };

  const create = useMutation({
    mutationFn: () => createKeyword({ term: term.trim(), category, weight: Number(weight) }),
    onSuccess: () => {
      toast.success(`Keyword “${term.trim()}” added`);
      setTerm("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      setKeywordActive(input.id, input.active),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteKeyword(id),
    onSuccess: () => {
      toast.success("Keyword removed");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Detected keyword labels are title-cased by the enrichment pipeline while the
  // library stores free-text terms, so counts are matched case-insensitively.
  const detectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [term, count] of detections.data?.counts ?? []) {
      const key = term.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + count);
    }
    return counts;
  }, [detections.data]);

  const rows = useMemo(() => {
    const list = keywords.data ?? [];
    return categoryFilter === "all" ? list : list.filter((k) => k.category === categoryFilter);
  }, [keywords.data, categoryFilter]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const keyword of keywords.data ?? []) {
      counts.set(keyword.category, (counts.get(keyword.category) ?? 0) + 1);
    }
    return KEYWORD_CATEGORIES.map((name) => ({ name, count: counts.get(name) ?? 0 }));
  }, [keywords.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keywords"
        description="Govern the detection vocabulary that drives complaint, fraud and escalation signals."
      />
      <ConversationIqTabs />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel
          title="Keyword library"
          description={`${formatNumber(rows.length)} terms in scope`}
          actions={
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-48 bg-surface text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {KEYWORD_CATEGORIES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          <ul className="divide-y divide-border/60">
            {rows.map((keyword) => (
              <li key={keyword.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Tags className="size-3.5 text-primary" />
                  {keyword.term}
                </span>
                <Chip tone="info">{keyword.category}</Chip>
                <Chip>weight {Number(keyword.weight).toFixed(2)}</Chip>
                <Chip>
                  {formatNumber(detectionCounts.get(keyword.term.toLowerCase()) ?? 0)} detections
                </Chip>
                <span className="ml-auto flex items-center gap-3">
                  <Switch
                    checked={keyword.is_active}
                    onCheckedChange={(checked) =>
                      toggle.mutate({ id: keyword.id, active: checked })
                    }
                    aria-label={`Toggle ${keyword.term}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove.mutate(keyword.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="py-12 text-center text-sm text-muted-foreground">
                No keywords in this category yet.
              </li>
            )}
          </ul>
        </Panel>

        <div className="space-y-6">
          <Panel title="Add custom keyword" description="New terms apply to future detection runs.">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!term.trim()) return;
                create.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label className="text-xs">Term</Label>
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="e.g. chargeback"
                  className="bg-surface"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KEYWORD_CATEGORIES.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Weight</Label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="bg-surface"
                />
              </div>
              <Button type="submit" className="w-full" disabled={!term.trim() || create.isPending}>
                <Plus className="mr-2 size-4" /> Add keyword
              </Button>
            </form>
          </Panel>

          <Panel title="Categories" description="Coverage across the enterprise taxonomy.">
            <ul className="space-y-2">
              {categories.map((entry) => (
                <li key={entry.name} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{entry.name}</span>
                  <Chip tone={entry.count > 0 ? "positive" : "neutral"}>{entry.count}</Chip>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
