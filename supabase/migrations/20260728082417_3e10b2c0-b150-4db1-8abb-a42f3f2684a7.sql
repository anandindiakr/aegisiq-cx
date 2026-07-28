
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_breached boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.alert_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  severity alert_severity NOT NULL,
  ack_minutes integer NOT NULL DEFAULT 15,
  resolve_minutes integer NOT NULL DEFAULT 120,
  escalate_after_minutes integer NOT NULL DEFAULT 30,
  backup_role app_role,
  backup_user_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, severity)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_sla_policies TO authenticated;
GRANT ALL ON public.alert_sla_policies TO service_role;
ALTER TABLE public.alert_sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert sla readable in tenant" ON public.alert_sla_policies
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "alert sla insert by admins" ON public.alert_sla_policies
  FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "alert sla update by admins" ON public.alert_sla_policies
  FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "alert sla delete by admins" ON public.alert_sla_policies
  FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_admin());

CREATE TRIGGER alert_sla_policies_updated_at BEFORE UPDATE ON public.alert_sla_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.alert_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  reason text NOT NULL,
  from_user_id uuid,
  to_user_id uuid,
  to_user_name text,
  to_role app_role,
  minutes_overdue integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.alert_escalations TO authenticated;
GRANT ALL ON public.alert_escalations TO service_role;
ALTER TABLE public.alert_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert escalations readable in tenant" ON public.alert_escalations
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "alert escalations insert in tenant" ON public.alert_escalations
  FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.can_operate());

CREATE INDEX IF NOT EXISTS alert_escalations_alert_idx ON public.alert_escalations (alert_id, created_at DESC);

-- Outlet-scoped triage: admins and regional managers act estate-wide; outlet
-- managers and supervisors only within the outlet on their profile.
CREATE OR REPLACE FUNCTION public.can_triage_alert(_outlet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(),'super_admin')
      OR public.has_role(auth.uid(),'tenant_admin')
      OR public.has_role(auth.uid(),'regional_manager')
      OR (
        (public.has_role(auth.uid(),'outlet_manager') OR public.has_role(auth.uid(),'supervisor'))
        AND (
          _outlet_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
              AND (p.outlet_id IS NULL OR p.outlet_id = _outlet_id)
          )
        )
      );
$$;

DROP POLICY IF EXISTS alerts_operate_update ON public.alerts;
CREATE POLICY alerts_operate_update ON public.alerts
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_triage_alert(outlet_id))
  WITH CHECK (company_id = public.current_company_id() AND public.can_triage_alert(outlet_id));

-- Keep lifecycle timestamps consistent whatever path updates the alert.
CREATE OR REPLACE FUNCTION public.sync_alert_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
      NEW.resolved_by := auth.uid();
    END IF;
    IF NEW.status = 'open' THEN
      NEW.resolved_at := NULL;
      NEW.resolved_by := NULL;
    END IF;
    IF NEW.status IN ('acknowledged','resolved','dismissed') AND NEW.acknowledged_at IS NULL THEN
      NEW.acknowledged_at := now();
      NEW.acknowledged_by := coalesce(NEW.acknowledged_by, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alerts_lifecycle ON public.alerts;
CREATE TRIGGER alerts_lifecycle BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.sync_alert_lifecycle();

-- Escalates unresolved alerts past their configured threshold to the backup owner.
CREATE OR REPLACE FUNCTION public.escalate_overdue_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  r record;
  v_backup uuid;
  v_backup_name text;
  n integer := 0;
BEGIN
  IF v_company IS NULL THEN RETURN 0; END IF;

  FOR r IN
    SELECT a.id, a.outlet_id, a.assigned_to, a.escalation_level, a.triggered_at, a.severity,
           p.escalate_after_minutes, p.backup_role, p.backup_user_id, p.resolve_minutes
    FROM public.alerts a
    JOIN public.alert_sla_policies p
      ON p.company_id = a.company_id AND p.severity = a.severity AND p.is_active
    WHERE a.company_id = v_company
      AND a.deleted_at IS NULL
      AND a.status IN ('open','acknowledged')
      AND a.escalation_level = 0
      AND a.triggered_at + (p.escalate_after_minutes || ' minutes')::interval < now()
  LOOP
    v_backup := r.backup_user_id;
    IF v_backup IS NULL AND r.backup_role IS NOT NULL THEN
      SELECT ur.user_id INTO v_backup
      FROM public.user_roles ur
      JOIN public.profiles pr ON pr.user_id = ur.user_id
      WHERE ur.company_id = v_company AND ur.role = r.backup_role
        AND (pr.outlet_id IS NULL OR r.outlet_id IS NULL OR pr.outlet_id = r.outlet_id)
        AND ur.user_id IS DISTINCT FROM r.assigned_to
      ORDER BY pr.outlet_id NULLS LAST
      LIMIT 1;
    END IF;

    SELECT pr.full_name INTO v_backup_name FROM public.profiles pr WHERE pr.user_id = v_backup LIMIT 1;

    UPDATE public.alerts
    SET escalation_level = 1,
        escalated_at = now(),
        sla_breached = true,
        sla_due_at = coalesce(sla_due_at, r.triggered_at + (r.resolve_minutes || ' minutes')::interval),
        assigned_to = coalesce(v_backup, assigned_to),
        assigned_at = CASE WHEN v_backup IS NOT NULL THEN now() ELSE assigned_at END
    WHERE id = r.id;

    INSERT INTO public.alert_escalations (
      company_id, alert_id, level, reason, from_user_id, to_user_id, to_user_name, to_role, minutes_overdue
    ) VALUES (
      v_company, r.id, 1,
      'Unresolved past the ' || r.escalate_after_minutes || ' minute ' || r.severity || ' threshold',
      r.assigned_to, v_backup, v_backup_name, r.backup_role,
      GREATEST(0, (EXTRACT(EPOCH FROM (now() - r.triggered_at)) / 60)::int - r.escalate_after_minutes)
    );

    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.escalate_overdue_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escalate_overdue_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_triage_alert(uuid) TO authenticated;

-- Default SLA policies per severity for existing tenants.
INSERT INTO public.alert_sla_policies (company_id, severity, ack_minutes, resolve_minutes, escalate_after_minutes, backup_role)
SELECT c.id, v.severity, v.ack, v.res, v.esc, v.backup::app_role
FROM public.companies c
CROSS JOIN (VALUES
  ('critical'::alert_severity, 5, 60, 15, 'tenant_admin'),
  ('high'::alert_severity, 15, 120, 45, 'regional_manager'),
  ('medium'::alert_severity, 30, 240, 120, 'outlet_manager'),
  ('low'::alert_severity, 120, 480, 360, 'outlet_manager'),
  ('info'::alert_severity, 240, 1440, 720, NULL)
) AS v(severity, ack, res, esc, backup)
WHERE c.deleted_at IS NULL
ON CONFLICT (company_id, severity) DO NOTHING;

-- Backfill resolved timestamps so MTTR reporting has history.
UPDATE public.alerts
SET resolved_at = coalesce(acknowledged_at, updated_at)
WHERE status = 'resolved' AND resolved_at IS NULL;
