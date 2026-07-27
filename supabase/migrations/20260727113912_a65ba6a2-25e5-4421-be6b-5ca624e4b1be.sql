-- ============ 1. Role administration ============
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE POLICY "roles_admin_read" ON public.user_roles
FOR SELECT TO authenticated
USING (company_id = public.current_company_id() AND public.is_company_admin());

CREATE POLICY "roles_admin_insert" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND public.is_company_admin()
  AND user_id <> auth.uid()
  AND (role <> 'super_admin'::app_role OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "roles_admin_update" ON public.user_roles
FOR UPDATE TO authenticated
USING (
  company_id = public.current_company_id()
  AND public.is_company_admin()
  AND user_id <> auth.uid()
)
WITH CHECK (
  company_id = public.current_company_id()
  AND public.is_company_admin()
  AND user_id <> auth.uid()
  AND (role <> 'super_admin'::app_role OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "roles_admin_delete" ON public.user_roles
FOR DELETE TO authenticated
USING (
  company_id = public.current_company_id()
  AND public.is_company_admin()
  AND user_id <> auth.uid()
  AND (role <> 'super_admin'::app_role OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

-- ============ 2. Configurable SLA policies ============
CREATE TABLE public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  priority review_priority NOT NULL DEFAULT 'normal',
  target_minutes integer NOT NULL DEFAULT 240,
  warning_percent integer NOT NULL DEFAULT 25,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sla_escalation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  policy_id uuid NOT NULL REFERENCES public.sla_policies(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  delay_minutes integer NOT NULL DEFAULT 30,
  action text NOT NULL DEFAULT 'notify',
  notify_role app_role,
  notify_email text,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sla_policies_priority_default_idx
  ON public.sla_policies (company_id, priority) WHERE is_default;
CREATE INDEX sla_steps_policy_idx ON public.sla_escalation_steps (policy_id, step_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_policies TO authenticated;
GRANT ALL ON public.sla_policies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_escalation_steps TO authenticated;
GRANT ALL ON public.sla_escalation_steps TO service_role;

ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_escalation_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_policies_read" ON public.sla_policies
FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "sla_policies_insert" ON public.sla_policies
FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "sla_policies_update" ON public.sla_policies
FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND public.can_operate())
WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "sla_policies_delete" ON public.sla_policies
FOR DELETE TO authenticated
USING (company_id = public.current_company_id() AND public.is_company_admin());

CREATE POLICY "sla_steps_read" ON public.sla_escalation_steps
FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "sla_steps_insert" ON public.sla_escalation_steps
FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "sla_steps_update" ON public.sla_escalation_steps
FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND public.can_operate())
WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "sla_steps_delete" ON public.sla_escalation_steps
FOR DELETE TO authenticated
USING (company_id = public.current_company_id() AND public.can_operate());

CREATE TRIGGER sla_policies_updated_at BEFORE UPDATE ON public.sla_policies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sla_steps_updated_at BEFORE UPDATE ON public.sla_escalation_steps
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed one policy per priority for the existing workspace, with escalation steps.
INSERT INTO public.sla_policies (company_id, name, description, priority, target_minutes, warning_percent, is_default)
SELECT c.id, x.name, x.description, x.priority::review_priority, x.target, 25, true
FROM public.companies c
CROSS JOIN (VALUES
  ('Urgent response', 'Critical escalations reviewed within the hour.', 'urgent', 60),
  ('High priority', 'Significant risk conversations.', 'high', 120),
  ('Standard review', 'Default reviewer service level.', 'normal', 240),
  ('Low priority', 'Routine sampling and quality checks.', 'low', 1440)
) AS x(name, description, priority, target)
WHERE c.deleted_at IS NULL;

INSERT INTO public.sla_escalation_steps (company_id, policy_id, step_order, delay_minutes, action, notify_role, note)
SELECT p.company_id, p.id, s.step_order, s.delay, s.action, s.role::app_role, s.note
FROM public.sla_policies p
CROSS JOIN (VALUES
  (1, 0, 'notify', 'supervisor', 'Notify the assigned reviewer at breach.'),
  (2, 30, 'escalate', 'outlet_manager', 'Escalate to the outlet manager.'),
  (3, 120, 'escalate', 'regional_manager', 'Escalate to the regional manager.')
) AS s(step_order, delay, action, role, note);

-- ============ 3. Transcript redaction ============
CREATE TABLE public.transcript_redactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  transcript_id uuid,
  start_offset integer NOT NULL DEFAULT 0,
  end_offset integer NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'pii',
  label text NOT NULL DEFAULT 'Redacted',
  reason text,
  original_snippet text,
  created_by uuid,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX transcript_redactions_conversation_idx
  ON public.transcript_redactions (conversation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcript_redactions TO authenticated;
GRANT ALL ON public.transcript_redactions TO service_role;

ALTER TABLE public.transcript_redactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "redactions_read" ON public.transcript_redactions
FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "redactions_insert" ON public.transcript_redactions
FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "redactions_update" ON public.transcript_redactions
FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND public.can_operate())
WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "redactions_delete" ON public.transcript_redactions
FOR DELETE TO authenticated
USING (company_id = public.current_company_id() AND public.can_operate());

CREATE TRIGGER transcript_redactions_updated_at BEFORE UPDATE ON public.transcript_redactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Export behaviour for redacted segments.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS redaction_export_mode text NOT NULL DEFAULT 'masked';

CREATE OR REPLACE FUNCTION public.validate_redaction_export_mode()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.redaction_export_mode NOT IN ('masked','unmasked_for_admins','blocked') THEN
    RAISE EXCEPTION 'Invalid redaction_export_mode: %', NEW.redaction_export_mode;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER companies_validate_redaction_mode
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.validate_redaction_export_mode();