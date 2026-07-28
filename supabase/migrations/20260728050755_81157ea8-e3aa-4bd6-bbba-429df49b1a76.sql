-- 1. Saved Command Centre filter presets ------------------------------------
CREATE TABLE public.command_filter_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.command_filter_presets TO authenticated;
GRANT ALL ON public.command_filter_presets TO service_role;
ALTER TABLE public.command_filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presets readable in workspace"
  ON public.command_filter_presets FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (is_shared OR user_id = auth.uid()));
CREATE POLICY "presets insert own"
  ON public.command_filter_presets FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid());
CREATE POLICY "presets update own or admin"
  ON public.command_filter_presets FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_company_admin()))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "presets delete own or admin"
  ON public.command_filter_presets FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_company_admin()));

CREATE TRIGGER command_filter_presets_updated_at
  BEFORE UPDATE ON public.command_filter_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Export / delivery audit --------------------------------------------------
CREATE TABLE public.export_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  actor_id uuid,
  actor_name text,
  kind text NOT NULL DEFAULT 'export',
  format text NOT NULL,
  template_id uuid,
  template_name text,
  template_version integer,
  sections text[] NOT NULL DEFAULT '{}',
  recipients text[] NOT NULL DEFAULT '{}',
  schedule_id uuid,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.export_audit_events TO authenticated;
GRANT ALL ON public.export_audit_events TO service_role;
ALTER TABLE public.export_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export audit readable in workspace"
  ON public.export_audit_events FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "export audit insert in workspace"
  ON public.export_audit_events FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());

CREATE INDEX export_audit_events_company_created_idx
  ON public.export_audit_events (company_id, created_at DESC);

-- 3. Board-report template versioning ----------------------------------------
ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE TABLE public.report_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.report_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  name text NOT NULL,
  description text,
  sections text[] NOT NULL DEFAULT '{}',
  formats text[] NOT NULL DEFAULT '{}',
  change_summary text,
  created_by uuid,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

GRANT SELECT, INSERT ON public.report_template_versions TO authenticated;
GRANT ALL ON public.report_template_versions TO service_role;
ALTER TABLE public.report_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template versions readable in workspace"
  ON public.report_template_versions FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "template versions insert by operators"
  ON public.report_template_versions FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_operate());

-- Snapshot existing templates as version 1
INSERT INTO public.report_template_versions
  (company_id, template_id, version, name, description, sections, formats, change_summary, created_by)
SELECT t.company_id, t.id, 1, t.name, t.description, t.sections, t.formats, 'Initial version', t.created_by
FROM public.report_templates t
ON CONFLICT (template_id, version) DO NOTHING;

-- 4. Role-based widget visibility --------------------------------------------
CREATE TABLE public.widget_access_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  widget_id text NOT NULL,
  roles app_role[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, widget_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.widget_access_rules TO authenticated;
GRANT ALL ON public.widget_access_rules TO service_role;
ALTER TABLE public.widget_access_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "widget rules readable in workspace"
  ON public.widget_access_rules FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "widget rules managed by admins"
  ON public.widget_access_rules FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());

CREATE TRIGGER widget_access_rules_updated_at
  BEFORE UPDATE ON public.widget_access_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults for every existing company
INSERT INTO public.widget_access_rules (company_id, widget_id, roles)
SELECT c.id, w.widget_id, w.roles
FROM public.companies c
CROSS JOIN (
  VALUES
    ('kpis',            ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager','supervisor','viewer']::app_role[]),
    ('summary',         ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager','supervisor']::app_role[]),
    ('score',           ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager','supervisor','viewer']::app_role[]),
    ('sentiment',       ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager','supervisor','viewer']::app_role[]),
    ('outlets',         ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager','supervisor']::app_role[]),
    ('map',             ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager','supervisor']::app_role[]),
    ('languages',       ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager','supervisor','viewer']::app_role[]),
    ('keywords',        ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager','supervisor','viewer']::app_role[]),
    ('alerts',          ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager','supervisor']::app_role[]),
    ('issues',          ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager','supervisor','viewer']::app_role[]),
    ('regions',         ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager','supervisor']::app_role[]),
    ('recommendations', ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager']::app_role[]),
    ('insights',        ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager']::app_role[]),
    ('activity',        ARRAY['super_admin','tenant_admin','regional_manager','outlet_manager','supervisor','viewer']::app_role[])
) AS w(widget_id, roles)
WHERE c.deleted_at IS NULL
ON CONFLICT (company_id, widget_id) DO NOTHING;

-- 5. Server-side widget authorisation helpers --------------------------------
CREATE OR REPLACE FUNCTION public.allowed_widgets()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(array_agg(r.widget_id), '{}')
  FROM public.widget_access_rules r
  WHERE r.company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = ANY (r.roles)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_widget(_widget_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.widget_access_rules r
      WHERE r.company_id = public.current_company_id() AND r.widget_id = _widget_id
    ) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.widget_access_rules r
      JOIN public.user_roles ur ON ur.user_id = auth.uid() AND ur.role = ANY (r.roles)
      WHERE r.company_id = public.current_company_id() AND r.widget_id = _widget_id
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.allowed_widgets() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_widget(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allowed_widgets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_widget(text) TO authenticated;
