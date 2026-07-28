import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, History, Search } from "lucide-react";
import { toast } from "sonner";

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
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { formatRelative } from "@/lib/format";
import { downloadCsv } from "@/features/infrastructure/pipeline";
import {
  ACTION_LABELS,
  auditToneFor,
  infraAuditQuery,
  infraAuditToCsv,
  type InfraAuditEvent,
  type InfraEntityType,
} from "@/features/infrastructure/audit";

function preview(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "on" : "off";
  const text = String(value);
  return text.length > 28 ? `${text.slice(0, 28)}…` : text;
}

/** Append-only change history for a device family. */
export function InfraChangeHistory({
  scope,
  title = "Change history",
  description = "Every configuration change, with the person who made it and the values before and after.",
}: {
  scope: InfraEntityType[];
  title?: string;
  description?: string;
}) {
  const { data, isPending, error, refetch } = useQuery(infraAuditQuery(scope));
  const [term, setTerm] = useState("");
  const [action, setAction] = useState("all");

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (data ?? []).filter((row) => {
      if (action !== "all" && row.action !== action) return false;
      if (!q) return true;
      return [row.entity_name, row.actor_name, row.summary, row.changed_fields.join(" ")]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [data, term, action]);

  const actions = useMemo(
    () => Array.from(new Set((data ?? []).map((row) => row.action))).sort(),
    [data],
  );

  return (
    <Panel
      title={title}
      description={description}
      actions={
        <Button
          size="sm"
          variant="outline"
          disabled={rows.length === 0}
          onClick={() => {
            downloadCsv(
              `aegisiq-infra-change-history-${new Date().toISOString().slice(0, 10)}.csv`,
              infraAuditToCsv(rows),
            );
            toast.success("Change history exported");
          }}
        >
          <Download className="mr-2 size-4" /> Export
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            maxLength={80}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search device, person or field"
            className="bg-surface pl-9"
          />
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="h-9 w-48 bg-surface">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Action: All</SelectItem>
            {actions.map((value) => (
              <SelectItem key={value} value={value}>
                {ACTION_LABELS[value] ?? value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : isPending ? (
        <LoadingState rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No changes recorded yet"
          description="Configuration edits, bulk actions, decommissions and credential access will appear here."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <HistoryRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function HistoryRow({ row }: { row: InfraAuditEvent }) {
  const [open, setOpen] = useState(false);
  const fields = row.changed_fields ?? [];

  return (
    <li className="rounded-lg border border-border bg-surface/40 px-3 py-2.5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <History className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{row.entity_name ?? "Device"}</span>
            <StatusPill
              label={ACTION_LABELS[row.action] ?? row.action}
              tone={auditToneFor(row.action)}
            />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {row.entity_type.replace(/_/g, " ")}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.summary}</p>
          {open && fields.length > 0 && (
            <div className="mt-2 grid gap-1 rounded-md border border-border bg-background/50 p-2">
              {fields.map((field) => (
                <div key={field} className="grid grid-cols-[minmax(0,140px)_1fr] gap-2 text-[11px]">
                  <span className="truncate font-mono text-muted-foreground">{field}</span>
                  <span className="truncate font-mono">
                    <span className="text-muted-foreground line-through">
                      {preview(row.before_state?.[field])}
                    </span>{" "}
                    → <span className="text-foreground">{preview(row.after_state?.[field])}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs">{row.actor_name ?? "System"}</p>
          <p className="text-[11px] text-muted-foreground">{formatRelative(row.created_at)}</p>
          {fields.length > 0 && (
            <button
              type="button"
              className="mt-1 text-[11px] text-primary hover:underline"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Hide detail" : `${fields.length} field${fields.length === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
