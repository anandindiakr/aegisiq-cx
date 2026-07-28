CREATE TABLE public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','slack','teams','webhook')),
  destination text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  recipient_user_ids uuid[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_rules TO authenticated;
GRANT ALL ON public.notification_rules TO service_role;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_rules_read" ON public.notification_rules
FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "notification_rules_insert" ON public.notification_rules
FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "notification_rules_update" ON public.notification_rules
FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND public.is_company_admin())
WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "notification_rules_delete" ON public.notification_rules
FOR DELETE TO authenticated
USING (company_id = public.current_company_id() AND public.is_company_admin());

CREATE TABLE public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  description text,
  active boolean NOT NULL DEFAULT true,
  last_status integer,
  last_error text,
  last_delivery_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_endpoints_read" ON public.webhook_endpoints
FOR SELECT TO authenticated
USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "webhook_endpoints_insert" ON public.webhook_endpoints
FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "webhook_endpoints_update" ON public.webhook_endpoints
FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND public.is_company_admin())
WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "webhook_endpoints_delete" ON public.webhook_endpoints
FOR DELETE TO authenticated
USING (company_id = public.current_company_id() AND public.is_company_admin());

CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  rule_id uuid REFERENCES public.notification_rules(id) ON DELETE SET NULL,
  endpoint_id uuid REFERENCES public.webhook_endpoints(id) ON DELETE SET NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  channel text NOT NULL,
  destination text NOT NULL,
  target_label text,
  status text NOT NULL CHECK (status IN ('sent','failed','skipped')),
  response_status integer,
  error_message text,
  attempt integer NOT NULL DEFAULT 1,
  duration_ms integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_deliveries_company_created_idx
  ON public.notification_deliveries (company_id, created_at DESC);

GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_deliveries_read" ON public.notification_deliveries
FOR SELECT TO authenticated USING (company_id = public.current_company_id());

CREATE TRIGGER notification_rules_updated_at
BEFORE UPDATE ON public.notification_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER webhook_endpoints_updated_at
BEFORE UPDATE ON public.webhook_endpoints
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();