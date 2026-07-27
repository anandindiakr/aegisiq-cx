import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Lock } from "lucide-react";

import { PageHeader, Panel } from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Ask natural-language questions about customer conversations, sentiment drivers and outlet performance.",
      },
      { property: "og:title", content: "AI Assistant — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Natural-language analysis across your customer experience estate.",
      },
    ],
  }),
  component: AssistantPage,
});

const SUGGESTIONS = [
  "Which outlet had the sharpest sentiment drop in the last 14 days?",
  "Summarise the top three drivers of refund conversations this month.",
  "List Arabic-language conversations that escalated to a manager.",
  "Compare average handling time between Canary Wharf and Dubai Mall.",
];

function AssistantPage() {
  return (
    <div>
      <PageHeader
        title="AI Assistant"
        description="Conversational analysis layer over your tenant's transcripts, summaries and operational metrics."
        actions={
          <Badge variant="outline" className="border-warning/30 text-warning">
            Model connection pending
          </Badge>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Ask AegisIQ"
          description="Queries run against your tenant data only — never across tenants"
          className="xl:col-span-2"
        >
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/25">
              <Sparkles className="size-5" />
            </span>
            <p className="mt-4 text-sm font-medium">Assistant activation is the next milestone</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              The retrieval layer, prompt governance and tenant-scoped grounding are wired into this
              workspace. Connect a model to enable live answers.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            <Textarea
              placeholder="Ask a question about your customer conversations…"
              className="min-h-24 resize-none bg-surface"
              maxLength={1000}
              disabled
            />
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Lock className="size-3.5" /> Tenant-isolated retrieval · prompts are audit logged
              </p>
              <Button disabled>Send</Button>
            </div>
          </div>
        </Panel>

        <Panel title="Suggested questions" description="Prepared for retail operations leaders">
          <ul className="space-y-2.5">
            {SUGGESTIONS.map((s) => (
              <li
                key={s}
                className="rounded-lg border border-border bg-surface/60 px-3 py-2.5 text-xs text-muted-foreground"
              >
                {s}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
