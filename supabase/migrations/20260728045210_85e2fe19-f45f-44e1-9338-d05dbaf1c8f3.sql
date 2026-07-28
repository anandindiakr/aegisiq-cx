CREATE TABLE public.report_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  name text not null,
  description text,
  sections text[] not null default '{}',
  formats text[] not null default array['pdf','excel','csv','powerpoint'],
  is_default boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_templates TO authenticated;
GRANT ALL ON public.report_templates TO service_role;

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_templates_select" ON public.report_templates
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "report_templates_insert" ON public.report_templates
  FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "report_templates_update" ON public.report_templates
  FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.can_operate())
  WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "report_templates_delete" ON public.report_templates
  FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.can_operate());

CREATE TRIGGER report_templates_updated_at BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.dashboard_audit_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  actor_id uuid,
  actor_name text,
  dashboard_key text not null default 'executive-command-centre',
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null,
  changed_fields text[] not null default '{}',
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT ON public.dashboard_audit_events TO authenticated;
GRANT ALL ON public.dashboard_audit_events TO service_role;

ALTER TABLE public.dashboard_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_audit_select" ON public.dashboard_audit_events
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "dashboard_audit_insert" ON public.dashboard_audit_events
  FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id());

CREATE INDEX dashboard_audit_events_created_idx ON public.dashboard_audit_events (company_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;