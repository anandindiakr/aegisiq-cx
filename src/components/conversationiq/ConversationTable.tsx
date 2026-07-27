import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  FileText,
  Loader2,
  Siren,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";
import {
  Chip,
  ConversationStatusBadge,
  LanguageBadge,
  RiskBadge,
  SentimentBadge,
  languageName,
} from "@/components/conversationiq/Badges";
import type { IqConversation, IqSummary } from "@/features/conversationiq/queries";
import { exportConversationsDeepCsv } from "@/features/conversationiq/export";
import type { AlertRow, Camera, Outlet } from "@/features/platform/queries";

type ColumnKey =
  | "reference"
  | "outlet"
  | "camera"
  | "date"
  | "start"
  | "duration"
  | "language"
  | "sentiment"
  | "risk"
  | "summary"
  | "status"
  | "alert";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  width: number;
  sortable?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "reference", label: "Conversation ID", width: 170, sortable: true },
  { key: "outlet", label: "Outlet", width: 170, sortable: true },
  { key: "camera", label: "Camera", width: 150, sortable: true },
  { key: "date", label: "Date", width: 130, sortable: true },
  { key: "start", label: "Start time", width: 110, sortable: true },
  { key: "duration", label: "Duration", width: 110, sortable: true },
  { key: "language", label: "Language", width: 130, sortable: true },
  { key: "sentiment", label: "Sentiment", width: 150, sortable: true },
  { key: "risk", label: "Risk", width: 120, sortable: true },
  { key: "summary", label: "Summary", width: 320 },
  { key: "status", label: "Status", width: 130, sortable: true },
  { key: "alert", label: "Alert", width: 120 },
];

const SENTIMENT_ORDER = ["very_negative", "negative", "neutral", "positive", "very_positive"];
const RISK_ORDER = ["low", "medium", "high"];

interface Props {
  rows: IqConversation[];
  outlets: Map<string, Outlet>;
  cameras: Map<string, Camera>;
  summaries: Map<string, IqSummary>;
  alerts: Map<string, AlertRow[]>;
  tags?: Map<string, string[]>;
  isLoading?: boolean;
}

function timeOf(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

export function ConversationTable({
  rows,
  outlets,
  cameras,
  summaries,
  alerts,
  tags,
  isLoading,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const [sortKey, setSortKey] = useState<ColumnKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<ColumnKey>>(new Set());
  const [widths, setWidths] = useState<Record<string, number>>(
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.width])),
  );
  const resizing = useRef<{ key: ColumnKey; startX: number; startWidth: number } | null>(null);

  const visibleColumns = COLUMNS.filter((c) => !hidden.has(c.key));

  const sorted = useMemo(() => {
    const value = (row: IqConversation): string | number => {
      switch (sortKey) {
        case "reference":
          return row.reference;
        case "outlet":
          return outlets.get(row.outlet_id ?? "")?.name ?? "";
        case "camera":
          return cameras.get(row.camera_id ?? "")?.name ?? "";
        case "duration":
          return row.duration_seconds;
        case "language":
          return languageName(row.language_code);
        case "sentiment":
          return SENTIMENT_ORDER.indexOf(row.sentiment);
        case "risk":
          return RISK_ORDER.indexOf(row.risk_level);
        case "status":
          return row.status;
        default:
          return new Date(row.started_at).getTime();
      }
    };
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir, outlets, cameras]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  function toggleSort(key: ColumnKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function startResize(event: React.MouseEvent, key: ColumnKey) {
    event.preventDefault();
    resizing.current = { key, startX: event.clientX, startWidth: widths[key] };
    const onMove = (e: MouseEvent) => {
      const state = resizing.current;
      if (!state) return;
      const next = Math.max(80, state.startWidth + (e.clientX - state.startX));
      setWidths((w) => ({ ...w, [state.key]: next }));
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function exportCsv() {
    const source = selected.size > 0 ? sorted.filter((r) => selected.has(r.id)) : sorted;
    const header = [
      "Conversation ID",
      "Outlet",
      "Camera",
      "Date",
      "Start time",
      "Duration (s)",
      "Language",
      "Sentiment",
      "Risk",
      "Status",
      "Escalated",
      "Summary",
    ];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      header.join(","),
      ...source.map((r) =>
        [
          r.reference,
          outlets.get(r.outlet_id ?? "")?.name ?? "",
          cameras.get(r.camera_id ?? "")?.name ?? "",
          formatDate(r.started_at),
          timeOf(r.started_at),
          String(r.duration_seconds),
          languageName(r.language_code),
          r.sentiment,
          r.risk_level,
          r.status,
          r.escalated ? "yes" : "no",
          summaries.get(r.id)?.summary ?? "",
        ]
          .map(escape)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conversationiq-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Full export: re-fetches transcripts and keywords for the current result set. */
  async function exportDeepCsv() {
    const source = selected.size > 0 ? sorted.filter((r) => selected.has(r.id)) : sorted;
    setExporting(true);
    try {
      const count = await exportConversationsDeepCsv(source, {
        outlets,
        cameras,
        summaries,
        alerts,
        tags,
      });
      toast.success(`Exported ${count} conversations with transcripts and keywords`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function renderCell(column: ColumnKey, row: IqConversation) {
    switch (column) {
      case "reference":
        return (
          <Link
            to="/conversationiq/$conversationId"
            params={{ conversationId: row.id }}
            className="font-mono text-xs text-primary hover:underline"
          >
            {row.reference}
          </Link>
        );
      case "outlet":
        return <span className="truncate">{outlets.get(row.outlet_id ?? "")?.name ?? "—"}</span>;
      case "camera":
        return (
          <span className="truncate text-muted-foreground">
            {cameras.get(row.camera_id ?? "")?.name ?? "—"}
          </span>
        );
      case "date":
        return <span className="text-muted-foreground">{formatDate(row.started_at)}</span>;
      case "start":
        return (
          <span className="font-mono text-xs text-muted-foreground">{timeOf(row.started_at)}</span>
        );
      case "duration":
        return <span className="font-mono text-xs">{formatDuration(row.duration_seconds)}</span>;
      case "language":
        return <LanguageBadge code={row.language_code} />;
      case "sentiment":
        return <SentimentBadge value={row.sentiment} />;
      case "risk":
        return <RiskBadge value={row.risk_level} />;
      case "summary":
        return (
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {summaries.get(row.id)?.summary ?? "Summary pending generation."}
          </span>
        );
      case "status":
        return <ConversationStatusBadge value={row.status} />;
      case "alert": {
        const list = alerts.get(row.id) ?? [];
        if (list.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <Chip tone={list.some((a) => a.status === "open") ? "negative" : "warning"}>
            <Siren className="size-3" />
            {list.length}
          </Chip>
        );
      }
      default:
        return null;
    }
  }

  return (
    <div className="panel flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {formatNumber(sorted.length)} conversations
          </span>
          {selected.size > 0 && <Chip tone="info">{selected.size} selected</Chip>}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="mr-2 size-4" /> Columns
                <ChevronDown className="ml-1 size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMNS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={!hidden.has(column.key)}
                  onCheckedChange={(checked) =>
                    setHidden((prev) => {
                      const next = new Set(prev);
                      if (checked) next.delete(column.key);
                      else next.add(column.key);
                      return next;
                    })
                  }
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={sorted.length === 0}>
            <Download className="mr-2 size-4" />
            Export{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          <Button
            size="sm"
            onClick={() => void exportDeepCsv()}
            disabled={sorted.length === 0 || exporting}
            title="Includes the full transcript, detected keywords, alerts and review tags"
          >
            {exporting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <FileText className="mr-2 size-4" />
            )}
            Full export{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </div>
      </div>

      <div className="max-h-[calc(100vh-20rem)] min-h-64 overflow-auto">
        <table className="w-full border-collapse text-sm" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 44 }} />
            {visibleColumns.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] }} />
            ))}
            <col style={{ width: 90 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
            <tr className="border-b border-border">
              <th className="px-3 py-2.5 text-left">
                <Checkbox
                  checked={allOnPageSelected}
                  aria-label="Select all rows on page"
                  onCheckedChange={(checked) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const row of pageRows) {
                        if (checked) next.add(row.id);
                        else next.delete(row.id);
                      }
                      return next;
                    })
                  }
                />
              </th>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  className="group relative px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  <button
                    type="button"
                    disabled={!column.sortable}
                    onClick={() => column.sortable && toggleSort(column.key)}
                    className={cn(
                      "flex items-center gap-1.5",
                      column.sortable && "hover:text-foreground",
                    )}
                  >
                    {column.label}
                    {column.sortable && (
                      <ArrowUpDown
                        className={cn(
                          "size-3 opacity-40",
                          sortKey === column.key && "text-primary opacity-100",
                        )}
                      />
                    )}
                  </button>
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    onMouseDown={(e) => startResize(e, column.key)}
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/40"
                  />
                </th>
              ))}
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td colSpan={visibleColumns.length + 2} className="px-3 py-3">
                    <span className="block h-4 w-full animate-pulse rounded bg-muted/40" />
                  </td>
                </tr>
              ))}
            {!isLoading && pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumns.length + 2}
                  className="px-3 py-16 text-center text-sm text-muted-foreground"
                >
                  No conversations match the current filters.
                </td>
              </tr>
            )}
            {pageRows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border/60 transition-colors hover:bg-surface/60",
                  selected.has(row.id) && "bg-primary/5",
                )}
              >
                <td className="px-3 py-2.5">
                  <Checkbox
                    checked={selected.has(row.id)}
                    aria-label={`Select ${row.reference}`}
                    onCheckedChange={(checked) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(row.id);
                        else next.delete(row.id);
                        return next;
                      })
                    }
                  />
                </td>
                {visibleColumns.map((column) => (
                  <td key={column.key} className="overflow-hidden px-3 py-2.5 align-middle">
                    {renderCell(column.key, row)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/conversationiq/$conversationId" params={{ conversationId: row.id }}>
                      <Eye className="mr-1.5 size-4" /> Open
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
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
              {[10, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span>
            Page {currentPage + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
