CREATE TABLE public.notification_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  members jsonb NOT NULL DEFAULT '[]'::jsonb,
  events text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'UTC',
  quiet_hours_start smallint,
  quiet_hours_end smallint,
  window_days smallint[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  send_window_start smallint NOT NULL DEFAULT 0,
  send_window_end smallint NOT NULL DEFAULT 24,
  bypass_quiet_for_failures boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_groups TO authenticated;
GRANT ALL ON public.notification_groups TO service_role;

ALTER TABLE public.notification_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_groups_read ON public.notification_groups
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY notification_groups_insert ON public.notification_groups
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY notification_groups_update ON public.notification_groups
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY notification_groups_delete ON public.notification_groups
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());

CREATE TRIGGER notification_groups_updated_at
  BEFORE UPDATE ON public.notification_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notification_deliveries
  ADD COLUMN group_id uuid REFERENCES public.notification_groups(id) ON DELETE SET NULL,
  ADD COLUMN dedupe_key text,
  ADD COLUMN idempotency_key text;

CREATE UNIQUE INDEX notification_deliveries_idempotency_idx
  ON public.notification_deliveries (company_id, idempotency_key, attempt)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX notification_deliveries_dedupe_idx
  ON public.notification_deliveries (company_id, dedupe_key);