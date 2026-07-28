/**
 * Configurable board-report templates.
 *
 * A template is simply the set of report sections an executive wants in their
 * export, plus the output formats it applies to. The export pipeline consumes
 * the section list so PDF, Excel, CSV and slide decks stay consistent.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import { logDashboardAudit } from "./audit";
import type { ExportFormat } from "./export";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export interface ReportSectionDef {
  id: string;
  label: string;
  description: string;
}

export const REPORT_SECTIONS: ReportSectionDef[] = [
  { id: "summary", label: "Executive summary", description: "AI narrative briefing" },
  { id: "kpis", label: "Key indicators", description: "Headline KPI block" },
  { id: "outlets", label: "Outlet performance", description: "Ranked outlet league table" },
  { id: "regions", label: "Regional comparison", description: "Region-level table" },
  { id: "languages", label: "Language analytics", description: "Conversation mix by language" },
  { id: "keywords", label: "Top keywords", description: "Most mentioned terms" },
  { id: "issues", label: "Top issues", description: "Ranked issue impact" },
  { id: "daily", label: "Daily trend", description: "30-day volume and sentiment" },
  { id: "recommendations", label: "Recommended actions", description: "AI suggested actions" },
];

export const ALL_SECTIONS = REPORT_SECTIONS.map((s) => s.id);

export interface ReportTemplate {
  id: string;
  name: string;
  description: string | null;
  sections: string[];
  formats: ExportFormat[];
  is_default: boolean;
  created_at: string;
}

export const reportTemplatesQuery = queryOptions({
  queryKey: ["report-templates"],
  queryFn: async () => {
    const { data, error } = await table("report_templates")
      .select("id,name,description,sections,formats,is_default,created_at")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ReportTemplate[];
  },
});

export interface ReportTemplateInput {
  name: string;
  description?: string | null;
  sections: string[];
  formats: ExportFormat[];
  is_default: boolean;
}

export async function createReportTemplate(input: ReportTemplateInput) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await table("report_templates")
    .insert({ ...input, company_id: getActiveTenant(), created_by: auth.user?.id ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await logDashboardAudit({
    entityType: "report_template",
    entityId: data?.id ?? null,
    action: "created",
    summary: `Report template "${input.name}" created with ${input.sections.length} sections`,
    changedFields: ["name", "sections", "formats"],
    after: input as unknown as Record<string, unknown>,
  });
}

export async function updateReportTemplate(
  id: string,
  patch: Partial<ReportTemplateInput>,
  before?: ReportTemplate,
) {
  const { error } = await table("report_templates").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await logDashboardAudit({
    entityType: "report_template",
    entityId: id,
    action: "updated",
    summary: `Report template "${before?.name ?? id}" updated`,
    changedFields: Object.keys(patch),
    before: before as unknown as Record<string, unknown>,
    after: patch as unknown as Record<string, unknown>,
  });
}

export async function deleteReportTemplate(id: string, before?: ReportTemplate) {
  const { error } = await table("report_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logDashboardAudit({
    entityType: "report_template",
    entityId: id,
    action: "deleted",
    summary: `Report template "${before?.name ?? id}" deleted`,
    changedFields: ["name"],
    before: before as unknown as Record<string, unknown>,
  });
}
