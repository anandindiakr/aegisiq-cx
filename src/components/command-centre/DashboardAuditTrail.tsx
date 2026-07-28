import { useQuery } from "@tanstack/react-query";
import { Download, History, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { auditCsv, dashboardAuditQuery } from "@/features/command-centre/audit";

const ENTITY_LABEL: Record<string, string> = {
  dashboard_layout: "Dashboard settings",
  report_schedule: "Scheduled report",
  report_template: "Report template",
};

export function DashboardAuditTrail() {
  const query = useQuery(dashboardAuditQuery);
  const rows = query.data ?? [];

  const download = () => {
    const blob = new Blob([auditCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="size-4" />
          Change history
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle>Dashboard change history</SheetTitle>
          <SheetDescription>
            Immutable record of widget visibility, ordering, refresh policy, report template and
            schedule changes.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-2 overflow-y-auto p-5">
          {query.isLoading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading history…
            </p>
          )}
          {query.isError && (
            <p className="text-xs text-destructive">
              {query.error instanceof Error ? query.error.message : "Could not load history."}
            </p>
          )}
          {!query.isLoading && rows.length === 0 && (
            <p className="text-xs text-muted-foreground">No dashboard changes recorded yet.</p>
          )}
          {rows.map((row) => (
            <article key={row.id} className="rounded-lg border border-border/70 bg-surface/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {ENTITY_LABEL[row.entity_type] ?? row.entity_type}
                </Badge>
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {row.action}
                </Badge>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("en-GB")}
                </span>
              </div>
              <p className="mt-2 text-sm">{row.summary}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                by {row.actor_name ?? "System"}
                {row.changed_fields.length > 0 && ` · ${row.changed_fields.join(", ")}`}
              </p>
            </article>
          ))}
        </div>

        <div className="border-t border-border p-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={rows.length === 0}
            onClick={download}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
