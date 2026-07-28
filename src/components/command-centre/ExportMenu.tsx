import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileSpreadsheet,
  FileText,
  History,
  LayoutTemplate,
  Loader2,
  Plus,
  Presentation,
  RotateCcw,
  Table2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportExecutiveReport, type ExportFormat } from "@/features/command-centre/export";
import { toRpcPayload, type CommandFilters } from "@/features/command-centre/filters";
import { logExportRun } from "@/features/command-centre/exportAudit";
import type { ExecutiveOverview } from "@/features/command-centre/types";
import {
  ALL_SECTIONS,
  REPORT_SECTIONS,
  createReportTemplate,
  deleteReportTemplate,
  diffVersions,
  reportTemplatesQuery,
  rollbackReportTemplate,
  templateVersionsQuery,
  updateReportTemplate,
  type ReportTemplate,
} from "@/features/command-centre/reportTemplates";

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

const FULL_TEMPLATE: ReportTemplate = {
  id: "__full__",
  name: "Full board pack",
  description: "Every section",
  sections: ALL_SECTIONS,
  formats: ["pdf", "excel", "csv", "powerpoint"],
  is_default: false,
  version: 1,
  created_at: "",
};

export function ExportMenu({
  overview,
  filters,
  disabled,
}: {
  overview: ExecutiveOverview | undefined;
  filters: CommandFilters;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string>(FULL_TEMPLATE.id);

  const templatesQuery = useQuery(reportTemplatesQuery);
  const templates = useMemo(
    () => [FULL_TEMPLATE, ...(templatesQuery.data ?? [])],
    [templatesQuery.data],
  );
  const active =
    templates.find((t) => t.id === templateId) ??
    templates.find((t) => t.is_default) ??
    FULL_TEMPLATE;

  const audit = (format: ExportFormat, status: "success" | "failed", extra?: string, ms?: number) =>
    void logExportRun({
      kind: "export",
      format,
      templateId: active.id === FULL_TEMPLATE.id ? null : active.id,
      templateName: active.name,
      templateVersion: active.version,
      sections: active.sections,
      status,
      errorMessage: extra ?? null,
      durationMs: ms ?? null,
      filters: toRpcPayload(filters),
    }).then(() => queryClient.invalidateQueries({ queryKey: ["export-audit-events"] }));

  const run = (format: ExportFormat) => {
    if (!overview) return;
    if (active.formats.length > 0 && !active.formats.includes(format)) {
      audit(format, "failed", `Format not enabled on template "${active.name}"`);
      toast.error("Format not enabled", {
        description: `"${active.name}" does not include ${format.toUpperCase()} output.`,
      });
      return;
    }
    setBusy(true);
    const started = performance.now();
    try {
      exportExecutiveReport(format, overview, filters, active.sections);
      audit(format, "success", undefined, Math.round(performance.now() - started));
      toast.success("Export started", {
        description: `${format.toUpperCase()} generated from "${active.name}" v${active.version}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      audit(format, "failed", message, Math.round(performance.now() - started));
      toast.error("Export failed", { description: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
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
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs">Board report template</DropdownMenuLabel>
          {templates.map((template) => (
            <DropdownMenuCheckboxItem
              key={template.id}
              checked={template.id === active.id}
              onCheckedChange={() => setTemplateId(template.id)}
              className="text-xs"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{template.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  v{template.version} · {template.sections.length} sections
                  {template.is_default ? " · default" : ""}
                </span>
              </span>
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuItem className="gap-2 text-xs" onSelect={() => setManageOpen(true)}>
            <LayoutTemplate className="size-4 text-muted-foreground" />
            Manage templates
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs">Export current view</DropdownMenuLabel>
          {OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.format}
              onSelect={() => run(option.format)}
              className="gap-2.5"
              disabled={active.formats.length > 0 && !active.formats.includes(option.format)}
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

      <TemplateManager
        open={manageOpen}
        onOpenChange={setManageOpen}
        templates={templatesQuery.data ?? []}
      />
    </>
  );
}

function TemplateManager({
  open,
  onOpenChange,
  templates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ReportTemplate[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [sections, setSections] = useState<string[]>(ALL_SECTIONS);
  const [formats, setFormats] = useState<ExportFormat[]>(["pdf", "excel", "csv", "powerpoint"]);
  const [isDefault, setIsDefault] = useState(false);
  const [historyFor, setHistoryFor] = useState<ReportTemplate | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: reportTemplatesQuery.queryKey });

  const create = useMutation({
    mutationFn: () =>
      createReportTemplate({ name: name.trim(), sections, formats, is_default: isDefault }),
    onSuccess: async () => {
      await refresh();
      toast.success("Template saved");
      setName("");
    },
    onError: (error: Error) =>
      toast.error("Could not save template", { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: (template: ReportTemplate) => deleteReportTemplate(template.id, template),
    onSuccess: async () => {
      await refresh();
      toast.success("Template deleted");
    },
    onError: (error: Error) => toast.error("Could not delete", { description: error.message }),
  });

  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Board report templates</DialogTitle>
            <DialogDescription>
              Choose which sections appear in the PDF, Excel, CSV and slide deck outputs. Every edit
              is versioned so you can preview and roll back changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border border-border/70 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Template name</Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Monthly board pack"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Sections</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {REPORT_SECTIONS.map((section) => (
                    <label
                      key={section.id}
                      className="flex items-start gap-2 rounded-md border border-border/60 p-2.5"
                    >
                      <Checkbox
                        checked={sections.includes(section.id)}
                        onCheckedChange={() => setSections((prev) => toggle(prev, section.id))}
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium">{section.label}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {section.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Formats</Label>
                <div className="flex flex-wrap gap-2">
                  {OPTIONS.map((option) => (
                    <label
                      key={option.format}
                      className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-xs"
                    >
                      <Checkbox
                        checked={formats.includes(option.format)}
                        onCheckedChange={() => setFormats((prev) => toggle(prev, option.format))}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs">Use as default template</Label>
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              </div>

              <Button
                size="sm"
                className="gap-2"
                disabled={!name.trim() || sections.length === 0 || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Save template
              </Button>
            </div>

            <div className="space-y-2">
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No saved templates yet — exports use the full board pack.
                </p>
              )}
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center gap-3 rounded-lg border border-border/70 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {template.name}
                      <Badge variant="secondary" className="text-[10px]">
                        v{template.version}
                      </Badge>
                      {template.is_default && (
                        <Badge variant="outline" className="text-[10px]">
                          Default
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {template.sections.join(", ") || "No sections"} ·{" "}
                      {template.formats.join(", ").toUpperCase()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setHistoryFor(template)}
                    aria-label={`Version history for ${template.name}`}
                  >
                    <History className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => remove.mutate(template)}
                    aria-label={`Delete ${template.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TemplateVersionHistory
        template={historyFor}
        onOpenChange={(next) => !next && setHistoryFor(null)}
      />
    </>
  );
}

function TemplateVersionHistory({
  template,
  onOpenChange,
}: {
  template: ReportTemplate | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const versions = useQuery(templateVersionsQuery(template?.id));
  const rows = versions.data ?? [];

  const rollback = useMutation({
    mutationFn: async (versionIndex: number) => {
      if (!template) return;
      await rollbackReportTemplate(template, rows[versionIndex]);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reportTemplatesQuery.queryKey });
      await queryClient.invalidateQueries({ queryKey: ["report-template-versions"] });
      toast.success("Template rolled back");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error("Rollback failed", { description: error.message }),
  });

  return (
    <Dialog open={template !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Version history — {template?.name}</DialogTitle>
          <DialogDescription>
            Preview what each version contains, see what changed and restore an earlier
            configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {versions.isLoading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading versions…
            </p>
          )}
          {!versions.isLoading && rows.length === 0 && (
            <p className="text-xs text-muted-foreground">No versions recorded yet.</p>
          )}
          {rows.map((version, index) => {
            const previous = rows[index + 1];
            const changes = previous ? diffVersions(previous, version) : ["Initial version"];
            const isCurrent = version.version === template?.version;
            return (
              <article
                key={version.id}
                className="rounded-lg border border-border/70 bg-surface/40 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isCurrent ? "default" : "outline"} className="text-[10px]">
                    v{version.version}
                    {isCurrent ? " · current" : ""}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {version.author_name ?? "System"} ·{" "}
                    {new Date(version.created_at).toLocaleString("en-GB")}
                  </span>
                  {!isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto h-7 gap-1.5 text-[11px]"
                      disabled={rollback.isPending}
                      onClick={() => rollback.mutate(index)}
                    >
                      <RotateCcw className="size-3.5" />
                      Restore
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {version.change_summary ?? "Template edited"}
                </p>
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                  {changes.map((change) => (
                    <li key={change}>• {change}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px]">
                  <span className="text-muted-foreground">Sections: </span>
                  {version.sections.join(", ") || "none"}
                </p>
                <p className="text-[11px]">
                  <span className="text-muted-foreground">Formats: </span>
                  {version.formats.join(", ").toUpperCase() || "none"}
                </p>
              </article>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { updateReportTemplate };
