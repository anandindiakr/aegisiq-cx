/**
 * Executive report templates manager.
 *
 * A template captures everything an executive wants repeated on a report:
 * which sections appear, the output formats and formatting, the narrative
 * language, and where the finished pack should go. Templates are versioned
 * by the shared report-template layer, so every edit stays auditable, and
 * they can be applied when re-running from "My executive reports".
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Plus, Star, Trash2 } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_DELIVERY,
  DEFAULT_FORMATTING,
  REPORT_SECTIONS,
  TEMPLATE_LANGUAGES,
  createReportTemplate,
  deleteReportTemplate,
  reportTemplatesQuery,
  updateReportTemplate,
  type ReportTemplate,
  type ReportTemplateInput,
  type TemplateDelivery,
  type TemplateFormatting,
} from "@/features/command-centre/reportTemplates";
import type { ExportFormat } from "@/features/command-centre/export";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/copilot/report-templates")({
  head: () => ({
    meta: [
      { title: "Executive report templates — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Save and reuse executive report configurations — sections, formatting, language and delivery — and apply them when re-running Copilot reports.",
      },
      { property: "og:title", content: "Executive report templates — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Manage reusable executive report templates for Aegis Copilot in AegisIQ CX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportTemplatesManager,
});

const FORMATS: ExportFormat[] = ["pdf", "excel", "csv", "powerpoint"];

const EMPTY: ReportTemplateInput = {
  name: "",
  description: "",
  sections: REPORT_SECTIONS.map((s) => s.id),
  formats: ["pdf"],
  is_default: false,
  language: "en",
  delivery: DEFAULT_DELIVERY,
  formatting: DEFAULT_FORMATTING,
};

function toInput(template: ReportTemplate): ReportTemplateInput {
  return {
    name: template.name,
    description: template.description ?? "",
    sections: template.sections ?? [],
    formats: template.formats ?? [],
    is_default: template.is_default,
    language: template.language ?? "en",
    delivery: { ...DEFAULT_DELIVERY, ...(template.delivery ?? {}) },
    formatting: { ...DEFAULT_FORMATTING, ...(template.formatting ?? {}) },
  };
}

function TemplateEditor({
  initial,
  existing,
  onDone,
}: {
  initial: ReportTemplateInput;
  existing?: ReportTemplate;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ReportTemplateInput>(initial);
  const [recipients, setRecipients] = useState(initial.delivery.recipients.join(", "));

  const patch = (part: Partial<ReportTemplateInput>) => setDraft((prev) => ({ ...prev, ...part }));
  const patchDelivery = (part: Partial<TemplateDelivery>) =>
    setDraft((prev) => ({ ...prev, delivery: { ...prev.delivery, ...part } }));
  const patchFormatting = (part: Partial<TemplateFormatting>) =>
    setDraft((prev) => ({ ...prev, formatting: { ...prev.formatting, ...part } }));

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const save = useMutation({
    mutationFn: async () => {
      const payload: ReportTemplateInput = {
        ...draft,
        name: draft.name.trim(),
        delivery: {
          ...draft.delivery,
          recipients: recipients
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean),
        },
      };
      if (existing) await updateReportTemplate(existing.id, payload, existing);
      else await createReportTemplate(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reportTemplatesQuery.queryKey });
      toast.success(existing ? "Template updated" : "Template saved");
      onDone();
    },
    onError: (error: Error) =>
      toast.error("Could not save template", { description: error.message }),
  });

  return (
    <div className="space-y-5 rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Template name</Label>
          <Input
            value={draft.name}
            maxLength={80}
            placeholder="Monthly board pack"
            onChange={(e) => patch({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Narrative language</Label>
          <Select value={draft.language} onValueChange={(value) => patch({ language: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_LANGUAGES.map((language) => (
                <SelectItem key={language.code} value={language.code}>
                  {language.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={draft.description ?? ""}
          maxLength={280}
          rows={2}
          placeholder="What this configuration is for"
          onChange={(e) => patch({ description: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Sections</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_SECTIONS.map((section) => (
            <label
              key={section.id}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <Checkbox
                checked={draft.sections.includes(section.id)}
                onCheckedChange={() => patch({ sections: toggle(draft.sections, section.id) })}
              />
              <span>
                <span className="text-foreground">{section.label}</span>
                <span className="block text-xs">{section.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Output formats</Label>
          <div className="flex flex-wrap gap-3">
            {FORMATS.map((format) => (
              <label key={format} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={draft.formats.includes(format)}
                  onCheckedChange={() => patch({ formats: toggle(draft.formats, format) })}
                />
                {format.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Formatting</Label>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <Switch
                checked={draft.formatting.coverPage}
                onCheckedChange={(v) => patchFormatting({ coverPage: v })}
              />
              Cover page
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={draft.formatting.includeCharts}
                onCheckedChange={(v) => patchFormatting({ includeCharts: v })}
              />
              Charts
            </label>
            <Select
              value={draft.formatting.density}
              onValueChange={(value) =>
                patchFormatting({ density: value as TemplateFormatting["density"] })
              }
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Comfortable</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 p-3">
        <Label>Delivery</Label>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            <Switch
              checked={draft.delivery.autoExport}
              onCheckedChange={(v) =>
                patchDelivery({
                  autoExport: v,
                  formats:
                    v && draft.delivery.formats.length === 0
                      ? draft.formats
                      : draft.delivery.formats,
                })
              }
            />
            Auto-export when a run completes
          </label>
          <label className="flex items-center gap-2">
            <Switch
              checked={draft.delivery.notifyOnComplete}
              onCheckedChange={(v) => patchDelivery({ notifyOnComplete: v })}
            />
            Notify on completion
          </label>
          <label className="flex items-center gap-2">
            <Switch
              checked={draft.delivery.notifyOnFailure}
              onCheckedChange={(v) => patchDelivery({ notifyOnFailure: v })}
            />
            Notify on failure
          </label>
        </div>
        {draft.delivery.autoExport && (
          <div className="flex flex-wrap gap-3">
            {FORMATS.map((format) => (
              <label key={format} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={draft.delivery.formats.includes(format)}
                  onCheckedChange={() =>
                    patchDelivery({ formats: toggle(draft.delivery.formats, format) })
                  }
                />
                {format.toUpperCase()}
              </label>
            ))}
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Extra recipients (comma separated)
          </Label>
          <Input
            value={recipients}
            maxLength={400}
            placeholder="ceo@company.com, board@company.com"
            onChange={(e) => setRecipients(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={draft.is_default} onCheckedChange={(v) => patch({ is_default: v })} />
          Use as my default template
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button
            disabled={!draft.name.trim() || draft.sections.length === 0 || save.isPending}
            onClick={() => save.mutate()}
          >
            {existing ? "Save changes" : "Create template"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReportTemplatesManager() {
  const { data, isLoading, isError, error, refetch } = useQuery(reportTemplatesQuery);
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const templates = useMemo(() => data ?? [], [data]);

  const remove = useMutation({
    mutationFn: (template: ReportTemplate) => deleteReportTemplate(template.id, template),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reportTemplatesQuery.queryKey });
      toast.success("Template deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Executive report templates"
        description="Save the sections, formatting, language and delivery options you use most — then apply a template when re-running a report from My executive reports."
      />

      <Panel
        title="Templates"
        actions={
          <Button size="sm" onClick={() => setCreating((v) => !v)}>
            <Plus className="mr-1 size-4" /> New template
          </Button>
        }
      >
        <div className="space-y-3">
          {creating && <TemplateEditor initial={EMPTY} onDone={() => setCreating(false)} />}

          {isLoading ? (
            <LoadingState rows={3} />
          ) : isError ? (
            <ErrorState
              message={error instanceof Error ? error.message : "Could not load templates."}
              onRetry={() => void refetch()}
            />
          ) : templates.length === 0 ? (
            <EmptyState
              title="No templates yet"
              description="Create a template to reuse a report configuration across runs."
            />
          ) : (
            templates.map((template) =>
              editingId === template.id ? (
                <TemplateEditor
                  key={template.id}
                  initial={toInput(template)}
                  existing={template}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <div
                  key={template.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface/60 p-3.5"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <FileText className="size-4 text-primary" />
                      <span className="truncate">{template.name}</span>
                      {template.is_default && (
                        <Star className="size-3.5 fill-warning text-warning" />
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {template.sections.length} sections ·{" "}
                      {(template.formats ?? []).join(", ").toUpperCase() || "no formats"} ·{" "}
                      {(template.language ?? "en").toUpperCase()} · v{template.version} ·{" "}
                      {formatDateTime(template.created_at)}
                    </p>
                    {template.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {template.delivery?.autoExport && <Badge variant="outline">Auto-export</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(template.id)}>
                      Edit
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(template)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </Panel>
    </div>
  );
}
