import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Chip } from "@/components/conversationiq/Badges";
import { ConversationIqTabs } from "@/components/conversationiq/ModuleTabs";
import { useIqAccess } from "@/features/conversationiq/access";
import {
  EXPORT_MODE_LABELS,
  REDACTION_CATEGORY_LABELS,
  allRedactionsQuery,
  applyRedactions,
  deleteRedaction,
  setRedactionExportMode,
  type RedactionExportMode,
} from "@/features/conversationiq/redaction";
import { companyQuery } from "@/features/platform/queries";
import { formatDate, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conversationiq/redactions")({
  head: () => ({
    meta: [
      { title: "Redactions — ConversationIQ™ | AegisIQ CX" },
      {
        name: "description",
        content:
          "Governance register of masked transcript segments, with role-based reveal and tenant-wide export behaviour controls.",
      },
      { property: "og:title", content: "Redactions — ConversationIQ™" },
      {
        property: "og:description",
        content: "Sensitive transcript segments, who masked them, and how exports treat them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RedactionRegisterPage,
});

function RedactionRegisterPage() {
  const queryClient = useQueryClient();
  const access = useIqAccess();
  const canReveal = access.can("revealRedactions");
  const canManage = access.can("manageRedactions");
  const redactions = useQuery(allRedactionsQuery);
  const company = useQuery(companyQuery);
  const mode = (company.data?.redaction_export_mode ?? "masked") as RedactionExportMode;

  const saveMode = useMutation({
    mutationFn: (value: RedactionExportMode) => setRedactionExportMode(value),
    onSuccess: () => {
      toast.success("Export behaviour updated");
      void queryClient.invalidateQueries({ queryKey: companyQuery.queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRedaction(id),
    onSuccess: () => {
      toast.success("Redaction lifted");
      void queryClient.invalidateQueries({ queryKey: ["iq", "redactions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = redactions.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transcript redactions"
        description="Sensitive segments stay in the record for compliance but are masked everywhere they are displayed. Only workspace admins can reveal the original text."
      />
      <ConversationIqTabs />

      <Panel
        title="Export behaviour"
        description="How redacted segments are treated in conversation and compliance exports across this workspace."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={mode}
            onValueChange={(value) => saveMode.mutate(value as RedactionExportMode)}
            disabled={!canReveal || saveMode.isPending}
          >
            <SelectTrigger className="h-9 w-[26rem] max-w-full bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EXPORT_MODE_LABELS) as RedactionExportMode[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {EXPORT_MODE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!canReveal && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldAlert className="size-3.5" /> Only workspace admins can change this.
            </span>
          )}
        </div>
      </Panel>

      <Panel
        title={`${formatNumber(rows.length)} redacted segments`}
        description="Newest first, across every conversation in this workspace."
      >
        {redactions.isPending && <LoadingState />}
        {redactions.error && (
          <ErrorState
            message={(redactions.error as Error).message}
            onRetry={() => void redactions.refetch()}
          />
        )}
        {!redactions.isPending && rows.length === 0 && (
          <EmptyState
            title="Nothing redacted yet"
            description="Open a conversation, select sensitive text in the transcript and choose Redact to mask it."
          />
        )}

        <ul className="divide-y divide-border/60">
          {rows.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start gap-3 py-3">
              <EyeOff className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {canReveal
                    ? (item.original_snippet ?? "—")
                    : applyRedactions(
                        item.original_snippet ?? "",
                        [
                          {
                            ...item,
                            start_offset: 0,
                            end_offset: (item.original_snippet ?? "").length,
                          },
                        ],
                        false,
                      )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {REDACTION_CATEGORY_LABELS[item.category]} · {item.author_name ?? "System"} ·{" "}
                  {formatDate(item.created_at)}
                  {item.reason ? ` · ${item.reason}` : ""}
                </p>
              </div>
              <Chip tone="warning">{item.label}</Chip>
              <Button asChild variant="ghost" size="sm">
                <Link
                  to="/conversationiq/$conversationId"
                  params={{ conversationId: item.conversation_id }}
                >
                  Open
                </Link>
              </Button>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Lift redaction"
                  onClick={() => remove.mutate(item.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
