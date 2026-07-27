import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, ShieldCheck } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auditLogsQuery } from "@/features/platform/queries";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit logs — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Immutable governance trail of every privileged action taken inside the tenant, with actor, entity and timestamp.",
      },
      { property: "og:title", content: "Audit logs — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Immutable governance trail of privileged tenant actions.",
      },
    ],
  }),
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const { data, isPending, error, refetch } = useQuery(auditLogsQuery);
  const [term, setTerm] = useState("");

  const rows = (data ?? []).filter((log) => {
    const q = term.trim().toLowerCase();
    if (!q) return true;
    return (
      log.action.toLowerCase().includes(q) ||
      log.entity_type.toLowerCase().includes(q) ||
      (log.actor_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Audit logs"
        description="Append-only record of configuration, access and triage events. Retained for compliance review."
      />

      <Panel
        title={`${rows.length} events`}
        description="Write-protected — entries cannot be edited or deleted by tenant users"
      >
        <div className="relative mb-5 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search action, entity or actor"
            className="bg-surface pl-9"
            maxLength={80}
          />
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isPending ? (
          <LoadingState rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No audit events"
            description="Privileged actions performed in this workspace will be recorded here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Source IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((log) => (
                  <TableRow key={log.id} className="border-border">
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell className="text-xs">{log.actor_name ?? "system"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border font-mono text-[11px]">
                        <ShieldCheck className="mr-1.5 size-3 text-primary" />
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.entity_type}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {log.ip_address ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
