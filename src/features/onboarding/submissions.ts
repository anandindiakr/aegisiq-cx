import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Answers } from "./schema";
import type { ApprovalWorkflow, OrgRoleMapping } from "./roles";

export interface OnboardingSubmission {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  status: string;
  answers: Answers;
  role_mappings: OrgRoleMapping[];
  approval_workflows: ApprovalWorkflow[];
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export const SUBMISSION_STATUSES = ["submitted", "in_review", "configured", "archived"] as const;

function normalise(row: Record<string, unknown>): OnboardingSubmission {
  return {
    ...(row as unknown as OnboardingSubmission),
    answers: (row["answers"] ?? {}) as Answers,
    role_mappings: (row["role_mappings"] ?? []) as OrgRoleMapping[],
    approval_workflows: (row["approval_workflows"] ?? []) as ApprovalWorkflow[],
  };
}

export const submissionsQuery = queryOptions({
  queryKey: ["onboarding-submissions"],
  queryFn: async (): Promise<OnboardingSubmission[]> => {
    const { data, error } = await supabase
      .from("onboarding_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => normalise(row as Record<string, unknown>));
  },
});

export interface SubmissionPayload {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  answers: Answers;
  role_mappings: OrgRoleMapping[];
  approval_workflows: ApprovalWorkflow[];
}

/** Public form submit — allowed for anonymous visitors by RLS. */
export async function submitQuestionnaire(payload: SubmissionPayload) {
  const { error } = await supabase.from("onboarding_submissions").insert({
    company_name: payload.company_name,
    contact_name: payload.contact_name,
    contact_email: payload.contact_email,
    contact_phone: payload.contact_phone ?? null,
    answers: payload.answers as never,
    role_mappings: payload.role_mappings as never,
    approval_workflows: payload.approval_workflows as never,
  });
  if (error) throw new Error(error.message);
}

export async function updateSubmission(
  id: string,
  patch: { status?: string; internal_notes?: string },
) {
  const { error } = await supabase.from("onboarding_submissions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSubmission(id: string) {
  const { error } = await supabase.from("onboarding_submissions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
