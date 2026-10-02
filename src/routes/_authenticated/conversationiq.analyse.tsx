import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  ScanSearch,
  Target,
  TrendingDown,
  TrendingUp,
  Minus,
  ListTodo,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, Panel, StatusPill } from "@/components/common/Primitives";
import { ConversationIqTabs } from "@/components/conversationiq/ModuleTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { analyseTranscriptInsights } from "@/lib/transcript-insights.functions";

export const Route = createFileRoute("/_authenticated/conversationiq/analyse")({
  head: () => ({
    meta: [
      { title: "Transcript Analyser — ConversationIQ™ | AegisIQ CX" },
      {
        name: "description",
        content:
          "Paste a customer conversation to identify intent, sentiment drivers and follow-up actions with AI.",
      },
      { property: "og:title", content: "Transcript Analyser — ConversationIQ™" },
      {
        property: "og:description",
        content: "AI-powered intent, sentiment-driver and next-action analysis for any transcript.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalysePage,
});

const SAMPLE = `Customer: Hi, I bought a blender here last week and it already stopped working.
Staff: I'm sorry to hear that. Do you have your receipt?
Customer: Yes, but I've already come back twice and nobody helped. This is really frustrating.
Staff: I understand. Let me check if we can do an exchange today.
Customer: I just want a refund honestly, I don't trust this model anymore.
Staff: Refunds need manager approval, he's out until tomorrow.
Customer: Unbelievable. Fine, but if this isn't sorted tomorrow I'm posting a review.`;

const impactTone = { positive: "positive", negative: "negative", neutral: "neutral" } as const;
const prioTone = { high: "negative", medium: "warning", low: "neutral" } as const;

function AnalysePage() {
  const [transcript, setTranscript] = useState("");
  const [context, setContext] = useState("");
  const analyse = useServerFn(analyseTranscriptInsights);
  const run = useMutation({
    mutationFn: () => analyse({ data: { transcript, context: context.trim() || undefined } }),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.error);
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("too short") ? "Transcript is too short to analyse" : e.message,
      ),
  });
  const result = run.data?.ok ? run.data.insights : null;
  const SentIcon = !result
    ? Minus
    : result.sentiment.score > 0.15
      ? TrendingUp
      : result.sentiment.score < -0.15
        ? TrendingDown
        : Minus;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transcript Analyser"
        description="Submit a conversation transcript to identify customer intent, sentiment drivers and recommended follow-up actions."
      />
      <ConversationIqTabs />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel
          title="Transcript"
          description="Paste speaker-labelled lines. Nothing is stored — analysis runs on demand."
          actions={
            <Button variant="ghost" size="sm" onClick={() => setTranscript(SAMPLE)}>
              Load sample
            </Button>
          }
        >
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (transcript.trim().length < 40) {
                toast.error("Transcript is too short to analyse");
                return;
              }
              run.mutate();
            }}
          >
            <Input
              placeholder="Optional context (e.g. outlet, channel, product)"
              value={context}
              maxLength={500}
              onChange={(e) => setContext(e.target.value)}
            />
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              maxLength={40000}
              rows={16}
              placeholder="Customer: ...&#10;Staff: ..."
              className="font-mono text-xs"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {transcript.length.toLocaleString()} / 40,000
              </span>
              <Button type="submit" disabled={run.isPending}>
                {run.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ScanSearch className="size-4" />
                )}
                {run.isPending ? "Analysing…" : "Analyse transcript"}
              </Button>
            </div>
          </form>
        </Panel>

        <div className="space-y-6">
          {!result && (
            <Panel title="Insights">
              <p className="py-10 text-center text-sm text-muted-foreground">
                {run.isPending
                  ? "Reading the conversation…"
                  : run.data && !run.data.ok
                    ? run.data.error
                    : "Results appear here after you analyse a transcript."}
              </p>
            </Panel>
          )}
          {result && (
            <>
              <Panel title="Intent & sentiment" description={result.summary}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-3">
                    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <Target className="size-3.5" /> Primary intent
                    </p>
                    <p className="mt-1 font-medium">{result.intent.primary}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {Math.round(result.intent.confidence * 100)}% confidence
                    </p>
                    {result.intent.secondary.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {result.intent.secondary.map((s) => (
                          <StatusPill key={s} label={s} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <SentIcon className="size-3.5" /> Sentiment
                    </p>
                    <p className="mt-1 font-medium capitalize">
                      {result.sentiment.overall.replace(/_/g, " ")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Score {result.sentiment.score.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Panel>
              <Panel title="Sentiment drivers">
                <ul className="space-y-3">
                  {result.drivers.map((d, i) => (
                    <li key={i} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{d.factor}</p>
                        <StatusPill label={d.impact} tone={impactTone[d.impact] ?? "neutral"} />
                      </div>
                      {d.evidence && (
                        <p className="mt-1 text-xs italic text-muted-foreground">“{d.evidence}”</p>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Recommended follow-up">
                <ul className="space-y-3">
                  {result.actions.map((a, i) => (
                    <li key={i} className="flex gap-3 rounded-lg border border-border p-3">
                      <ListTodo className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{a.action}</p>
                          <StatusPill label={a.priority} tone={prioTone[a.priority] ?? "neutral"} />
                        </div>
                        <p className="text-[11px] text-muted-foreground">Owner: {a.owner}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{a.rationale}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
