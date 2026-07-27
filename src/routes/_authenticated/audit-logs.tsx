import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireRoles } from "@/features/platform/tenant";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RotateCcw, Search, ShieldCheck } from "lucide-react";

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
import {
  auditLogFilterOptionsQuery,
  auditLogsPageQuery,
  outletsQuery,
} from "@/features/platform/queries";
import { formatDateTime, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  // Tenant-scoped role gate: administrative surface for company admins only.
  beforeLoad: ({ context }) => requireRoles(context.tenant, ["super_admin", "tenant_admin"]),
  head: () => ({
    meta: [
      { title: "Audit logs — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Immutable governance trail of every privileged action taken inside the tenant, filterable by user, outlet and action type.",
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

const PAGE_SIZES = [25, 50, 100];

function AuditLogsPage() {
  const [actor, setActor] = useState("all");
  const [action, setAction] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [outletId, setOutletId] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [term, setTerm] = useState("");

  const options = useQuery(auditLogFilterOptionsQuery);
  const outlets = useQuery(outletsQuery);
  const { data, isPending, isFetching, error, refetch } = useQuery({
    ...auditLogsPageQuery({ actor, action, entityType, outletId, page, pageSize }),
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    const list = data?.rows ?? [];
    if (!q) return list;
    return list.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.entity_type.toLowerCase().includes(q) ||
        (log.actor_name ?? "").toLowerCase().includes(q),
    );
  }, [data?.rows, term]);

  function reset() {
    setActor("all");
    setAction("all");
    setEntityType("all");
    setOutletId("all");
    setTerm("");
    setPage(0);
  }

  function change(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(0);
    };
  }

  return (
    <div>
      <PageHeader
        title="Audit logs"
        description="Append-only record of configuration, access and triage events. Retained for compliance review."
        actions={
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-2 size-4" /> Reset filters
          </Button>
        }
      />

      <Panel
        title={`${formatNumber(total)} events`}
        description="Write-protected — entries cannot be edited or deleted by tenant users"
      >
        <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">User</Label>
            <Select value={actor} onValueChange={change(setActor)}>
              <SelectTrigger className="bg-surface">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {(options.data?.actors ?? []).map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Outlet</Label>
            <Select value={outletId} onValueChange={change(setOutletId)}>
              <SelectTrigger className="bg-surface">
                <SelectValue placeholder="All outlets" />
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Action type</Label>
            <Select value={action} onValueChange={change(setAction)}>
              <SelectTrigger className="bg-surface">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {(options.data?.actions ?? []).map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Entity</Label>
            <Select value={entityType} onValueChange={change(setEntityType)}>
              <SelectTrigger className="bg-surface">
                <SelectValue placeholder="All entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {(options.data?.entityTypes ?? []).map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative mb-5 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search within this page"
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
            description="No entries match the current filters. Privileged actions performed in this workspace are recorded here."
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
                    <TableCell className="text-xs">{log.entity_type}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {log.ip_address ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(0);
              }}
            >
              <SelectTrigger className="h-8 w-20 bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isFetching && <span>Updating…</span>}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
