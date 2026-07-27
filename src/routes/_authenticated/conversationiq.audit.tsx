import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileClock, Loader2, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, Panel } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  describeAuditEvent,
  type ReviewAuditEvent,
  downloadCsv,
  fetchAuditForExport,
  reviewAuditQuery,
  toAuditCsv,
  type AuditEntityType,
} from "@/features/conversationiq/audit";
import { formatDate, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conversationiq/audit")({
  head: () => ({
    meta: [
      { title: "Review Audit Trail — ConversationIQ™ | AegisIQ CX" },
      {
        name: "description",
        content:
          "Immutable, tenant-scoped record of every conversation and reviewer queue change, with CSV export for compliance reviews.",
      },
      { property: "og:title", content: "Review Audit Trail — ConversationIQ™" },
      {
        property: "og:description",
        content: "Tamper-proof change history for conversations and reviewer queue items.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewAuditPage,
});

function ReviewAuditPage() {
  const [entityType, setEntityType] = useState<AuditEntityType | "all">("all");
  const [action, setAction] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState<ReviewAuditEvent | null>(null);

  const filters = useMemo(
    () => ({
      entityType,
      action,
      search,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    }),
    [entityType, action, search, from, to],
  );

  const events = useQuery(reviewAuditQuery(filters));
  const rows = events.data ?? [];

  async function exportCsv() {
    setExporting(true);
    try {
      const all = await fetchAuditForExport(filters);
      downloadCsv(
        `aegisiq-review-audit-${new Date().toISOString().slice(0, 10)}.csv`,
        toAuditCsv(all),
      );
      toast.success(`Exported ${formatNumber(all.length)} audit records`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Audit Trail"
        description="Every conversation and reviewer queue change is recorded by the database itself. Entries cannot be edited or deleted from the application."
      />
      <ConversationIqTabs />

      <Panel
        title={`${formatNumber(rows.length)} recorded changes`}
        description="Showing the most recent 500 entries for the selected filters. Exports include up to 10,000."
        actions={
          <Button variant="outline" size="sm" onClick={() => void exportCsv()} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            Export for compliance
          </Button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Select value={entityType} onValueChange={(v) => setEntityType(v as AuditEntityType)}>
            <SelectTrigger className="h-9 bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All records</SelectItem>
              <SelectItem value="conversation">Conversations</SelectItem>
              <SelectItem value="review_assignment">Queue items</SelectItem>
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-9 bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="removed">Removed</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Filter by reviewer"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 bg-surface"
          />
          <Input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-9 bg-surface"
          />
          <Input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-9 bg-surface"
          />
        </div>

        {events.isLoading && <p className="text-sm text-muted-foreground">Loading audit trail…</p>}
        {!events.isLoading && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <FileClock className="size-6" />
            <p className="text-sm">
              No recorded changes match these filters. Entries appear automatically as your team
              reviews conversations and works the queue.
            </p>
          </div>
        )}

        <ul className="divide-y divide-border/60">
          {rows.map((event) => (
            <li key={event.id} className="flex flex-wrap items-start gap-3 py-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{describeAuditEvent(event)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.actor_name ?? "System"} · {formatDate(event.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Chip tone={event.entity_type === "conversation" ? "info" : "neutral"}>
                  {event.entity_type === "conversation" ? "Conversation" : "Queue"}
                </Chip>
                <Button variant="ghost" size="sm" onClick={() => setDetail(event)}>
                  <Search className="mr-1.5 size-3.5" /> Details
                </Button>
                {event.conversation_id && (
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      to="/conversationiq/$conversationId"
                      params={{ conversationId: event.conversation_id }}
                    >
                      Open
                    </Link>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change detail</DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.actor_name ?? "System"} · ${formatDate(detail.created_at)}`
                : null}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <p className="text-sm">{describeAuditEvent(detail)}</p>
              <div className="overflow-hidden rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Field</th>
                      <th className="px-3 py-2 text-left font-medium">Before</th>
                      <th className="px-3 py-2 text-left font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {Array.from(
                      new Set([
                        ...detail.changed_fields,
                        ...Object.keys(detail.before_state ?? {}),
                        ...Object.keys(detail.after_state ?? {}),
                      ]),
                    ).map((field) => (
                      <tr key={field}>
                        <td className="px-3 py-2 font-medium">{field.replace(/_/g, " ")}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatStateValue((detail.before_state as Record<string, unknown>)[field])}
                        </td>
                        <td className="px-3 py-2">
                          {formatStateValue((detail.after_state as Record<string, unknown>)[field])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Record {detail.entity_type} · {detail.entity_id}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Renders a JSON audit snapshot value for the drilldown table. */
function formatStateValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
