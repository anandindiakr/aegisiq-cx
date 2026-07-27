CREATE TABLE public.role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  roles app_role[] NOT NULL DEFAULT '{}',
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_templates TO authenticated;
GRANT ALL ON public.role_templates TO service_role;

ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates are readable when shared or owned"
ON public.role_templates FOR SELECT TO authenticated
USING (is_shared OR company_id = public.current_company_id());

CREATE POLICY "Admins create templates in their workspace"
ON public.role_templates FOR INSERT TO authenticated
WITH CHECK (public.is_company_admin() AND company_id = public.current_company_id());

CREATE POLICY "Admins update their workspace templates"
ON public.role_templates FOR UPDATE TO authenticated
USING (public.is_company_admin() AND company_id = public.current_company_id())
WITH CHECK (public.is_company_admin() AND company_id = public.current_company_id());

CREATE POLICY "Admins delete their workspace templates"
ON public.role_templates FOR DELETE TO authenticated
USING (public.is_company_admin() AND company_id = public.current_company_id());

CREATE TRIGGER set_role_templates_updated_at
BEFORE UPDATE ON public.role_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX role_templates_company_idx ON public.role_templates (company_id);

ALTER TABLE public.companies
  ADD COLUMN active_role_template_id uuid REFERENCES public.role_templates(id) ON DELETE SET NULL;

INSERT INTO public.role_templates (id, company_id, name, description, roles, is_shared, capabilities) VALUES
('2a1f0001-0000-4000-8000-000000000001', NULL, 'Standard Retail Operations',
 'Balanced matrix for multi-outlet retail: supervisors review, managers assign, admins govern.',
 '{tenant_admin,regional_manager,outlet_manager,supervisor}', true,
 '{"viewTranscripts":["super_admin","tenant_admin","regional_manager","outlet_manager","supervisor"],"editNotesTags":["super_admin","tenant_admin","regional_manager","outlet_manager","supervisor"],"editAnchors":["super_admin","tenant_admin","regional_manager","outlet_manager","supervisor"],"moveQueue":["super_admin","tenant_admin","regional_manager","outlet_manager","supervisor"],"assignQueue":["super_admin","tenant_admin","regional_manager","outlet_manager"],"reviewAlerts":["super_admin","tenant_admin","regional_manager","outlet_manager","supervisor"],"exportCompliance":["super_admin","tenant_admin","regional_manager"],"viewAudit":["super_admin","tenant_admin","regional_manager"],"manageSla":["super_admin","tenant_admin","regional_manager"],"manageRedactions":["super_admin","tenant_admin","regional_manager","outlet_manager"],"revealRedactions":["super_admin","tenant_admin"],"manageRoles":["super_admin","tenant_admin"]}'::jsonb),
('2a1f0001-0000-4000-8000-000000000002', NULL, 'Compliance-Led Review',
 'Tighter governance: exports, audit and redaction reveal stay with admins only.',
 '{tenant_admin,regional_manager,supervisor}', true,
 '{"viewTranscripts":["super_admin","tenant_admin","regional_manager","outlet_manager","supervisor"],"editNotesTags":["super_admin","tenant_admin","regional_manager","supervisor"],"editAnchors":["super_admin","tenant_admin","regional_manager","supervisor"],"moveQueue":["super_admin","tenant_admin","regional_manager","supervisor"],"assignQueue":["super_admin","tenant_admin","regional_manager"],"reviewAlerts":["super_admin","tenant_admin","regional_manager","supervisor"],"exportCompliance":["super_admin","tenant_admin"],"viewAudit":["super_admin","tenant_admin"],"manageSla":["super_admin","tenant_admin"],"manageRedactions":["super_admin","tenant_admin","regional_manager"],"revealRedactions":["super_admin","tenant_admin"],"manageRoles":["super_admin","tenant_admin"]}'::jsonb),
('2a1f0001-0000-4000-8000-000000000003', NULL, 'Read-Only Oversight',
 'Observation model for pilots and audits: everyone can read, only admins can change anything.',
 '{tenant_admin,viewer}', true,
 '{"viewTranscripts":["super_admin","tenant_admin","regional_manager","outlet_manager","supervisor","viewer"],"editNotesTags":["super_admin","tenant_admin"],"editAnchors":["super_admin","tenant_admin"],"moveQueue":["super_admin","tenant_admin"],"assignQueue":["super_admin","tenant_admin"],"reviewAlerts":["super_admin","tenant_admin"],"exportCompliance":["super_admin","tenant_admin"],"viewAudit":["super_admin","tenant_admin","regional_manager"],"manageSla":["super_admin","tenant_admin"],"manageRedactions":["super_admin","tenant_admin"],"revealRedactions":["super_admin"],"manageRoles":["super_admin","tenant_admin"]}'::jsonb);