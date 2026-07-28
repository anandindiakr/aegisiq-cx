import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, FileText, Mic, Keyboard, Search } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { CopilotAuditEvent } from "@/features/copilot/audit";
import { requireRoles } from "@/features/platform/tenant";
import {
  COPILOT_INTENTS,
  COPILOT_OUTCOMES,
  DEFAULT_COPILOT_AUDIT_FILTERS,
  copilotAuditFacetsQuery,
  copilotAuditQuery,
  fetchCopilotAuditRows,
  openCopilotAuditPdf,
  toCopilotAuditCsv,
} from "@/features/copilot/audit";
import { formatDateTime, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/copilot-audit")({
  // Compliance surface: company administrators only.
  beforeLoad: ({ context }) => requireRoles(context.tenant, ["super_admin", "tenant_admin"]),
  head: () => ({
    meta: [
      { title: "Copilot audit — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Compliance review of every Aegis Copilot command: typed or spoken, resolved entities, outcomes and access-denied events.",
      },
      { property: "og:title", content: "Copilot audit — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Every copilot command, entity and access decision in one immutable trail.",
      },
    ],
  }),
  component: CopilotAuditPage,
});

const OUTCOME_TONE: Record<string, string> = {
  answered: "border-primary/30 text-primary",
  navigated: "border-primary/30 text-primary",
  exported: "border-success/40 text-success",
  denied: "border-destructive/40 text-destructive",
  failed: "border-destructive/40 text-destructive",
};

function CopilotAuditPage() {
  const [filters, setFilters] = useState(DEFAULT_COPILOT_AUDIT_FILTERS);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const { data: facets } = useQuery(copilotAuditFacetsQuery);

  const { data, isPending, isFetching, error, refetch } = useQuery({
    ...copilotAuditQuery(filters),
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));

  function patch(next: Partial<typeof filters>) {
    setFilters((prev) => ({ ...prev, page: 0, ...next }));
  }

  async function withFilteredRows(action: (all: CopilotAuditEvent[]) => void, label: string) {
    setExporting(true);
    try {
      const all = await fetchCopilotAuditRows(filters);
      if (all.length === 0) {
        toast.error("No copilot events match these filters.");
        return;
      }
      action(all);
      toast.success(`Exported ${formatNumber(all.length)} copilot events as ${label}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `The ${label} export failed.`);
    } finally {
      setExporting(false);
    }
  }

  function exportCsv() {
    void withFilteredRows((all) => {
      const blob = new Blob([toCopilotAuditCsv(all)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `copilot-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }, "CSV");
  }

  function exportPdf() {
    void withFilteredRows((all) => openCopilotAuditPdf(all, filters), "PDF");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Copilot audit"
        description="Immutable record of every Aegis Copilot™ command, the entities it resolved and the access decisions taken."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={exporting || total === 0}>
              <Download className="mr-2 size-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={exportPdf} disabled={exporting || total === 0}>
              <FileText className="mr-2 size-4" /> Export PDF
            </Button>
          </div>
        }
      />

      <Panel title="Filters" description={`${formatNumber(total)} recorded commands`}>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label className="text-xs">Search command or actor</Label>
            <form
              className="relative mt-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                patch({ search });
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onBlur={() => patch({ search })}
                placeholder="e.g. export report"
                className="pl-9"
              />
            </form>
          </div>
          <div>
            <Label className="text-xs">Tenant</Label>
            <Select value={filters.tenant} onValueChange={(value) => patch({ tenant: value })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                {(facets?.tenants ?? []).map((tenant) => (
                  <SelectItem key={tenant} value={tenant}>
                    {tenant.slice(0, 8)}…
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">User</Label>
            <Select value={filters.actor} onValueChange={(value) => patch({ actor: value })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {(facets?.actors ?? []).map((actor) => (
                  <SelectItem key={actor} value={actor}>
                    {actor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Command type</Label>
            <Select value={filters.intent} onValueChange={(value) => patch({ intent: value })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All intents</SelectItem>
                {COPILOT_INTENTS.map((intent) => (
                  <SelectItem key={intent} value={intent}>
                    {intent.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Mode</Label>
              <Select
                value={filters.mode}
                onValueChange={(value) => patch({ mode: value as typeof filters.mode })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="voice">Voice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Outcome</Label>
              <Select
                value={filters.outcome}
                onValueChange={(value) => patch({ outcome: value as typeof filters.outcome })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {COPILOT_OUTCOMES.map((outcome) => (
                    <SelectItem key={outcome} value={outcome}>
                      {outcome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Command trail" description="Newest first">
        {isPending ? (
          <LoadingState rows={5} />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No copilot activity"
            description="Commands issued from the copilot dock will appear here for compliance review."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Command</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Entities</TableHead>
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const entities = Object.entries(row.resolved_entities ?? {})
                    .filter(([, value]) => value !== null && value !== undefined && value !== "")
                    .map(([key, value]) => `${key}: ${String(value)}`);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-xs">
                        {row.actor_name ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-xs">{row.command}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.intent.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {row.input_mode === "voice" ? (
                            <Mic className="size-3" />
                          ) : (
                            <Keyboard className="size-3" />
                          )}
                          {row.input_mode}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-xs text-muted-foreground">
                        {entities.length > 0 ? entities.join(" · ") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={OUTCOME_TONE[row.outcome] ?? "text-muted-foreground"}
                          title={row.denied_reason ?? undefined}
                        >
                          {row.outcome}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {filters.page + 1} of {pageCount}
            {isFetching ? " · refreshing…" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page === 0}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page + 1 >= pageCount}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
