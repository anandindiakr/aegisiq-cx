import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Presentation, Table2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportExecutiveReport, type ExportFormat } from "@/features/command-centre/export";
import type { CommandFilters } from "@/features/command-centre/filters";
import type { ExecutiveOverview } from "@/features/command-centre/types";

const OPTIONS: { format: ExportFormat; label: string; hint: string; icon: typeof FileText }[] = [
  { format: "pdf", label: "PDF report", hint: "Board-ready document", icon: FileText },
  { format: "excel", label: "Excel workbook", hint: "Multi-sheet analysis", icon: FileSpreadsheet },
  { format: "csv", label: "CSV data", hint: "Raw aggregated tables", icon: Table2 },
  {
    format: "powerpoint",
    label: "Slide deck",
    hint: "Executive briefing slides",
    icon: Presentation,
  },
];

export function ExportMenu({
  overview,
  filters,
  disabled,
}: {
  overview: ExecutiveOverview | undefined;
  filters: CommandFilters;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const run = (format: ExportFormat) => {
    if (!overview) return;
    setBusy(true);
    try {
      exportExecutiveReport(format, overview, filters);
      toast.success(`Export started`, {
        description: `${format.toUpperCase()} generated from the current filters.`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !overview || busy}
          className="gap-2"
        >
          <Download className="size-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs">Export current view</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.format}
            onSelect={() => run(option.format)}
            className="gap-2.5"
          >
            <option.icon className="size-4 text-muted-foreground" />
            <span className="flex flex-col">
              <span className="text-xs font-medium">{option.label}</span>
              <span className="text-[11px] text-muted-foreground">{option.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
