ALTER TABLE public.command_filter_presets
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS scope_roles app_role[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.validate_preset_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.scope NOT IN ('personal','role','outlet') THEN
    RAISE EXCEPTION 'Invalid preset scope: %', NEW.scope;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_preset_scope_trg ON public.command_filter_presets;
CREATE TRIGGER validate_preset_scope_trg
BEFORE INSERT OR UPDATE ON public.command_filter_presets
FOR EACH ROW EXECUTE FUNCTION public.validate_preset_scope();

CREATE TABLE IF NOT EXISTS public.widget_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  widget_id text NOT NULL,
  requester_id uuid NOT NULL,
  requester_name text,
  requester_email text,
  reason text,
  context text,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.widget_access_requests TO authenticated;
GRANT ALL ON public.widget_access_requests TO service_role;

ALTER TABLE public.widget_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own or admins read all requests"
ON public.widget_access_requests FOR SELECT TO authenticated
USING (company_id = public.current_company_id() AND (requester_id = auth.uid() OR public.is_company_admin()));

CREATE POLICY "Members raise their own requests"
ON public.widget_access_requests FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id() AND requester_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins decide requests"
ON public.widget_access_requests FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND public.is_company_admin())
WITH CHECK (company_id = public.current_company_id());

CREATE TRIGGER widget_access_requests_updated_at
BEFORE UPDATE ON public.widget_access_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS widget_access_requests_company_status_idx
  ON public.widget_access_requests (company_id, status, created_at DESC);