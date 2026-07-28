/**
 * Template preview.
 *
 * Renders the report a template would actually produce, using live tenant
 * data from the executive overview rather than lorem placeholders — so the
 * section mix, ordering, language and formatting can be judged before the
 * template is saved or re-run.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/common/Primitives";
import { executiveOverviewQuery } from "@/features/command-centre/queries";
import { defaultFilters, withPreset } from "@/features/command-centre/filters";
import {
  cxScore,
  executiveBriefing,
  rankedIssues,
  recommendations,
} from "@/features/command-centre/insights";
import type { ExecutiveOverview } from "@/features/command-centre/types";
import {
  REPORT_SECTIONS,
  TEMPLATE_LANGUAGES,
  type ReportTemplateInput,
} from "@/features/command-centre/reportTemplates";
import { formatDateTime } from "@/lib/format";

function SectionShell({
  title,
  compact,
  children,
}: {
  title: string;
  compact: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-border/60 bg-surface/50 ${compact ? "p-2.5" : "p-4"}`}
    >
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className={compact ? "text-xs" : "text-sm"}>{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground">No data in the current window.</p>;
  }
  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3">
          <span className="truncate text-muted-foreground">{row.label}</span>
          <span className="shrink-0 font-medium text-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function renderSection(
  id: string,
  overview: ExecutiveOverview,
  compact: boolean,
  charts: boolean,
) {
  const def = REPORT_SECTIONS.find((section) => section.id === id);
  const title = def?.label ?? id;
  const pct = (value: number) => `${Math.round(value)}%`;

  switch (id) {
    case "summary":
      return (
        <SectionShell key={id} title={title} compact={compact}>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            {executiveBriefing(overview)
              .slice(0, compact ? 3 : 5)
              .map((line) => (
                <li key={line}>{line}</li>
              ))}
          </ul>
        </SectionShell>
      );
    case "kpis": {
      const k = overview.kpis;
      return (
        <SectionShell key={id} title={title} compact={compact}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Conversations", value: k.total.toLocaleString() },
              { label: "CX score", value: String(cxScore(overview)) },
              { label: "Escalations", value: k.escalations.toLocaleString() },
              { label: "Alerts", value: k.alerts.toLocaleString() },
            ].map((item) => (
              <div key={item.label} className="rounded-md border border-border/50 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">{item.label}</p>
                <p className="text-base font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </SectionShell>
      );
    }
    case "outlets":
      return (
        <SectionShell key={id} title={title} compact={compact}>
          <Rows
            rows={overview.outlets
              .slice(0, compact ? 3 : 5)
              .map((outlet) => ({
                label: outlet.name,
                value: `${Math.round(outlet.overall_score)} · ${outlet.conversations} convos`,
              }))}
          />
        </SectionShell>
      );
    case "regions":
      return (
        <SectionShell key={id} title={title} compact={compact}>
          <Rows
            rows={overview.regions.slice(0, compact ? 3 : 6).map((region) => ({
              label: region.region,
              value: `${region.conversations} convos · ${pct(region.conversations ? (region.negatives / region.conversations) * 100 : 0)} negative`,
            }))}
          />
        </SectionShell>
      );
    case "languages":
      return (
        <SectionShell key={id} title={title} compact={compact}>
          <Rows
            rows={overview.languages.slice(0, compact ? 3 : 6).map((language) => ({
              label: language.name,
              value: `${language.conversations} convos`,
            }))}
          />
        </SectionShell>
      );
    case "keywords":
      return (
        <SectionShell key={id} title={title} compact={compact}>
          <div className="flex flex-wrap gap-1.5">
            {overview.keywords.slice(0, compact ? 6 : 12).map((keyword) => (
              <Badge key={keyword.term} variant="secondary" className="text-[10px]">
                {keyword.term} · {keyword.mentions}
              </Badge>
            ))}
            {overview.keywords.length === 0 && (
              <span className="text-muted-foreground">No keyword mentions yet.</span>
            )}
          </div>
        </SectionShell>
      );
    case "issues":
      return (
        <SectionShell key={id} title={title} compact={compact}>
          <Rows
            rows={rankedIssues(overview)
              .slice(0, compact ? 3 : 6)
              .map((issue) => ({
                label: issue.label,
                value: `${issue.occurrences} occurrences`,
              }))}
          />
        </SectionShell>
      );
    case "daily":
      return (
        <SectionShell key={id} title={title} compact={compact}>
          {charts ? (
            <div className="flex h-16 items-end gap-1">
              {overview.daily.slice(-30).map((point) => {
                // Values can arrive as numeric strings from the RPC payload.
                const max = Math.max(...overview.daily.map((d) => Number(d.conversations) || 0), 1);
                const value = Number(point.conversations) || 0;
                return (
                  <div
                    key={point.day}
                    className="min-w-[3px] flex-1 rounded-t-[2px] bg-primary/60"
                    style={{ height: `${Math.max(6, (value / max) * 100)}%` }}
                    title={`${point.day}: ${value}`}
                  />
                );
              })}
            </div>
          ) : (
            <Rows
              rows={overview.daily.slice(-5).map((point) => ({
                label: point.day,
                value: `${point.conversations} convos`,
              }))}
            />
          )}
        </SectionShell>
      );
    case "recommendations":
      return (
        <SectionShell key={id} title={title} compact={compact}>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            {recommendations(overview)
              .slice(0, compact ? 3 : 5)
              .map((item) => (
                <li key={item.title}>
                  <span className="text-foreground">{item.title}</span> — {item.detail}
                </li>
              ))}
          </ul>
        </SectionShell>
      );
    default:
      return (
        <SectionShell key={id} title={title} compact={compact}>
          <p className="text-muted-foreground">{def?.description ?? "Section preview"}</p>
        </SectionShell>
      );
  }
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ReportTemplateInput;
}) {
  // A 30-day window keeps the sample representative rather than empty at 9am.
  const filters = useMemo(() => withPreset(defaultFilters(), "30d"), []);
  const overview = useQuery({ ...executiveOverviewQuery(filters), enabled: open });

  const compact = template.formatting.density === "compact";
  const language =
    TEMPLATE_LANGUAGES.find((item) => item.code === template.language)?.label ?? "English";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview — {template.name || "Untitled template"}</DialogTitle>
          <DialogDescription>
            Sample report rendered from your live workspace data. Nothing is exported or delivered.
          </DialogDescription>
        </DialogHeader>

        {overview.isLoading ? (
          <LoadingState rows={4} />
        ) : overview.isError || !overview.data ? (
          <ErrorState
            message={
              overview.error instanceof Error
                ? overview.error.message
                : "Could not load preview data."
            }
            onRetry={() => void overview.refetch()}
          />
        ) : (
          <div className="space-y-3">
            {template.formatting.coverPage && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs uppercase tracking-wide text-primary">Executive report</p>
                <p className="text-lg font-semibold text-foreground">
                  {template.name || "Untitled template"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(overview.data.range.from)} → {formatDateTime(overview.data.range.to)} ·{" "}
                  {language} · {template.formatting.density}
                </p>
                {template.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                ) : null}
              </div>
            )}

            {template.sections.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                Select at least one section to preview.
              </p>
            ) : (
              template.sections.map((id) =>
                renderSection(id, overview.data, compact, template.formatting.includeCharts),
              )
            )}

            <p className="text-xs text-muted-foreground">
              Output formats:{" "}
              {template.formats.length
                ? template.formats.join(", ").toUpperCase()
                : "none selected"}
              {template.delivery.autoExport ? " · auto-export on completion" : ""}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
