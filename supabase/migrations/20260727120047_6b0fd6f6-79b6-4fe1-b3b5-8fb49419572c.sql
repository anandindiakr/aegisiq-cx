
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

CREATE TABLE IF NOT EXISTS public.executive_report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  frequency text NOT NULL DEFAULT 'daily',
  format text NOT NULL DEFAULT 'pdf',
  recipients text[] NOT NULL DEFAULT '{}',
  send_hour integer NOT NULL DEFAULT 8,
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_report_schedules TO authenticated;
GRANT ALL ON public.executive_report_schedules TO service_role;
ALTER TABLE public.executive_report_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report schedules readable in tenant" ON public.executive_report_schedules;
CREATE POLICY "report schedules readable in tenant" ON public.executive_report_schedules
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "report schedules insert" ON public.executive_report_schedules;
CREATE POLICY "report schedules insert" ON public.executive_report_schedules
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_operate());

DROP POLICY IF EXISTS "report schedules update" ON public.executive_report_schedules;
CREATE POLICY "report schedules update" ON public.executive_report_schedules
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_operate())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS "report schedules delete" ON public.executive_report_schedules;
CREATE POLICY "report schedules delete" ON public.executive_report_schedules
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_operate());

DROP TRIGGER IF EXISTS set_updated_at_report_schedules ON public.executive_report_schedules;
CREATE TRIGGER set_updated_at_report_schedules BEFORE UPDATE ON public.executive_report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  dashboard_key text NOT NULL DEFAULT 'executive-command-centre',
  hidden_widgets text[] NOT NULL DEFAULT '{}',
  widget_order text[] NOT NULL DEFAULT '{}',
  refresh_interval_seconds integer NOT NULL DEFAULT 60,
  auto_refresh boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dashboard_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_layouts TO authenticated;
GRANT ALL ON public.dashboard_layouts TO service_role;
ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "layouts own" ON public.dashboard_layouts;
CREATE POLICY "layouts own" ON public.dashboard_layouts
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id())
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());

DROP TRIGGER IF EXISTS set_updated_at_dashboard_layouts ON public.dashboard_layouts;
CREATE TRIGGER set_updated_at_dashboard_layouts BEFORE UPDATE ON public.dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
