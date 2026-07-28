/**
 * Configurable, versioned board-report templates.
 *
 * A template is the set of report sections an executive wants in their export,
 * plus the output formats it applies to. Every edit snapshots the previous
 * state into `report_template_versions`, so template changes can be previewed,
 * rolled back and audited over time.
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
  version: number;
  created_at: string;
}

export interface ReportTemplateVersion {
  id: string;
  template_id: string;
  version: number;
  name: string;
  description: string | null;
  sections: string[];
  formats: ExportFormat[];
  change_summary: string | null;
  author_name: string | null;
  created_at: string;
}

export const reportTemplatesQuery = queryOptions({
  queryKey: ["report-templates"],
  queryFn: async () => {
    const { data, error } = await table("report_templates")
      .select("id,name,description,sections,formats,is_default,version,created_at")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ReportTemplate[];
  },
});

export function templateVersionsQuery(templateId: string | undefined) {
  return queryOptions({
    queryKey: ["report-template-versions", templateId ?? "none"],
    queryFn: async () => {
      if (!templateId) return [] as ReportTemplateVersion[];
      const { data, error } = await table("report_template_versions")
        .select(
          "id,template_id,version,name,description,sections,formats,change_summary,author_name,created_at",
        )
        .eq("template_id", templateId)
        .order("version", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ReportTemplateVersion[];
    },
  });
}

export interface ReportTemplateInput {
  name: string;
  description?: string | null;
  sections: string[];
  formats: ExportFormat[];
  is_default: boolean;
}

async function currentActor(): Promise<{ id: string | null; name: string | null }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { id: null, name: null };
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return { id: auth.user.id, name: data?.full_name ?? auth.user.email ?? null };
}

async function snapshot(
  templateId: string,
  version: number,
  state: ReportTemplateInput,
  changeSummary: string,
) {
  const actor = await currentActor();
  await table("report_template_versions").insert({
    company_id: getActiveTenant(),
    template_id: templateId,
    version,
    name: state.name,
    description: state.description ?? null,
    sections: state.sections,
    formats: state.formats,
    change_summary: changeSummary,
    created_by: actor.id,
    author_name: actor.name,
  });
}

export async function createReportTemplate(input: ReportTemplateInput) {
  const actor = await currentActor();
  const { data, error } = await table("report_templates")
    .insert({ ...input, version: 1, company_id: getActiveTenant(), created_by: actor.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (data?.id) await snapshot(data.id, 1, input, "Initial version");
  await logDashboardAudit({
    entityType: "report_template",
    entityId: data?.id ?? null,
    action: "created",
    summary: `Report template "${input.name}" created with ${input.sections.length} sections (v1)`,
    changedFields: ["name", "sections", "formats"],
    after: input as unknown as Record<string, unknown>,
  });
}

/** Applies a patch and records the resulting state as the next version. */
export async function updateReportTemplate(
  id: string,
  patch: Partial<ReportTemplateInput>,
  before: ReportTemplate,
  changeSummary?: string,
) {
  const nextVersion = (before.version ?? 1) + 1;
  const merged: ReportTemplateInput = {
    name: patch.name ?? before.name,
    description: patch.description ?? before.description,
    sections: patch.sections ?? before.sections,
    formats: patch.formats ?? before.formats,
    is_default: patch.is_default ?? before.is_default,
  };
  const { error } = await table("report_templates")
    .update({ ...patch, version: nextVersion })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await snapshot(id, nextVersion, merged, changeSummary ?? "Template edited");
  await logDashboardAudit({
    entityType: "report_template",
    entityId: id,
    action: "updated",
    summary: `Report template "${before.name}" updated to v${nextVersion}`,
    changedFields: Object.keys(patch),
    before: before as unknown as Record<string, unknown>,
    after: merged as unknown as Record<string, unknown>,
  });
}

/** Restores a historical version as a new version (history stays immutable). */
export async function rollbackReportTemplate(
  template: ReportTemplate,
  version: ReportTemplateVersion,
) {
  await updateReportTemplate(
    template.id,
    {
      name: version.name,
      description: version.description,
      sections: version.sections,
      formats: version.formats,
    },
    template,
    `Rolled back to v${version.version}`,
  );
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

/** Human-readable difference between two template versions. */
export function diffVersions(
  a: Pick<ReportTemplateVersion, "name" | "sections" | "formats">,
  b: Pick<ReportTemplateVersion, "name" | "sections" | "formats">,
): string[] {
  const notes: string[] = [];
  if (a.name !== b.name) notes.push(`Renamed "${a.name}" → "${b.name}"`);
  const added = b.sections.filter((s) => !a.sections.includes(s));
  const removed = a.sections.filter((s) => !b.sections.includes(s));
  if (added.length) notes.push(`Added sections: ${added.join(", ")}`);
  if (removed.length) notes.push(`Removed sections: ${removed.join(", ")}`);
  const fAdded = b.formats.filter((f) => !a.formats.includes(f));
  const fRemoved = a.formats.filter((f) => !b.formats.includes(f));
  if (fAdded.length) notes.push(`Enabled formats: ${fAdded.join(", ").toUpperCase()}`);
  if (fRemoved.length) notes.push(`Disabled formats: ${fRemoved.join(", ").toUpperCase()}`);
  return notes.length ? notes : ["No section or format changes"];
}
