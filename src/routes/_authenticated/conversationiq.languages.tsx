import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader, Panel } from "@/components/common/Primitives";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/conversationiq/Badges";
import { ConversationIqTabs } from "@/components/conversationiq/ModuleTabs";
import {
  iqConversationsQuery,
  iqLanguagesQuery,
  setLanguageActive,
} from "@/features/conversationiq/queries";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conversationiq/languages")({
  head: () => ({
    meta: [
      { title: "Language Detection — ConversationIQ™ | AegisIQ CX" },
      {
        name: "description",
        content:
          "Enable or disable supported detection languages and review detection confidence and coverage.",
      },
      { property: "og:title", content: "Language Detection — ConversationIQ™" },
      {
        property: "og:description",
        content:
          "Multilingual detection coverage across English, Chinese, Malay, Tamil and Tagalog.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LanguagesPage,
});

function LanguagesPage() {
  const queryClient = useQueryClient();
  const languages = useQuery(iqLanguagesQuery);
  const conversations = useQuery(iqConversationsQuery);

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of conversations.data ?? []) {
      counts.set(row.language_code, (counts.get(row.language_code) ?? 0) + 1);
      if (row.secondary_language_code) {
        counts.set(row.secondary_language_code, (counts.get(row.secondary_language_code) ?? 0) + 1);
      }
    }
    return counts;
  }, [conversations.data]);

  const toggle = useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      setLanguageActive(input.id, input.active),
    onSuccess: () => {
      toast.success("Language setting updated");
      void queryClient.invalidateQueries({ queryKey: iqLanguagesQuery.queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Languages"
        description="Control which languages the detection pipeline recognises and monitor confidence by language."
      />
      <ConversationIqTabs />

      <Panel
        title="Supported languages"
        description="Detection confidence is measured against verified transcripts."
      >
        <ul className="divide-y divide-border/60">
          {(languages.data ?? []).map((language) => {
            const confidence = Math.round(Number(language.detection_confidence) * 100);
            return (
              <li key={language.id} className="flex flex-wrap items-center gap-4 py-4">
                <div className="min-w-40">
                  <p className="text-sm font-medium">{language.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {language.native_name ?? language.code.toUpperCase()} · {language.code}
                  </p>
                </div>
                <Chip tone={language.is_active ? "positive" : "neutral"}>
                  {language.is_active ? "Enabled" : "Disabled"}
                </Chip>
                <Chip tone="info">{formatNumber(usage.get(language.code) ?? 0)} conversations</Chip>
                <div className="min-w-48 flex-1">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Detection confidence</span>
                    <span className="font-medium text-foreground">{confidence}%</span>
                  </div>
                  <Progress value={confidence} className="h-2" />
                </div>
                <Switch
                  checked={language.is_active}
                  onCheckedChange={(checked) => toggle.mutate({ id: language.id, active: checked })}
                  aria-label={`Toggle ${language.name}`}
                />
              </li>
            );
          })}
          {(languages.data ?? []).length === 0 && (
            <li className="py-12 text-center text-sm text-muted-foreground">
              No languages configured for this workspace.
            </li>
          )}
        </ul>
      </Panel>
    </div>
  );
}
