-- Alert read state (per user, scoped to tenant)
CREATE TABLE public.alert_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, alert_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_reads TO authenticated;
GRANT ALL ON public.alert_reads TO service_role;

ALTER TABLE public.alert_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own alert read markers"
  ON public.alert_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());

CREATE POLICY "Members create own alert read markers"
  ON public.alert_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());

CREATE POLICY "Members update own alert read markers"
  ON public.alert_reads FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id())
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());

CREATE POLICY "Members delete own alert read markers"
  ON public.alert_reads FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());

CREATE TRIGGER set_alert_reads_updated_at
  BEFORE UPDATE ON public.alert_reads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX alert_reads_company_user_idx ON public.alert_reads (company_id, user_id);

-- SSO claim -> role / outlet mapping
CREATE TABLE public.sso_role_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'saml',
  claim_key text NOT NULL,
  claim_value text NOT NULL,
  role public.app_role NOT NULL,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  deleted_at timestamptz,
  UNIQUE (company_id, provider, claim_key, claim_value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sso_role_mappings TO authenticated;
GRANT ALL ON public.sso_role_mappings TO service_role;

ALTER TABLE public.sso_role_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view sso mappings"
  ON public.sso_role_mappings FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Admins create sso mappings"
  ON public.sso_role_mappings FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());

CREATE POLICY "Admins update sso mappings"
  ON public.sso_role_mappings FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());

CREATE POLICY "Admins delete sso mappings"
  ON public.sso_role_mappings FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());

CREATE TRIGGER set_sso_role_mappings_updated_at
  BEFORE UPDATE ON public.sso_role_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX sso_role_mappings_company_idx ON public.sso_role_mappings (company_id, is_active);