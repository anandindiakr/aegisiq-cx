CREATE TABLE public.onboarding_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  status text NOT NULL DEFAULT 'submitted',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  role_mappings jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_workflows jsonb NOT NULL DEFAULT '[]'::jsonb,
  internal_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.onboarding_submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_submissions TO authenticated;
GRANT ALL ON public.onboarding_submissions TO service_role;

ALTER TABLE public.onboarding_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can submit onboarding questionnaires"
  ON public.onboarding_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins read onboarding submissions"
  ON public.onboarding_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.is_company_admin());

CREATE POLICY "Admins update onboarding submissions"
  ON public.onboarding_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.is_company_admin())
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.is_company_admin());

CREATE POLICY "Admins delete onboarding submissions"
  ON public.onboarding_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.is_company_admin());

CREATE TRIGGER onboarding_submissions_updated_at
  BEFORE UPDATE ON public.onboarding_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX onboarding_submissions_created_idx ON public.onboarding_submissions (created_at DESC);