-- 1. Widget access request SLA + expiry -------------------------------------
ALTER TABLE public.widget_access_requests
  ADD COLUMN IF NOT EXISTS sla_minutes integer NOT NULL DEFAULT 480,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz;

UPDATE public.widget_access_requests
SET due_at = coalesce(due_at, created_at + (sla_minutes || ' minutes')::interval),
    expires_at = coalesce(expires_at, created_at + interval '7 days');

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'public.widget_access_requests'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.widget_access_requests DROP CONSTRAINT %I', c);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_access_request_sla()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending','approved','denied','expired') THEN
    RAISE EXCEPTION 'Invalid access request status: %', NEW.status;
  END IF;
  IF NEW.due_at IS NULL THEN
    NEW.due_at := coalesce(NEW.created_at, now()) + (coalesce(NEW.sla_minutes, 480) || ' minutes')::interval;
  END IF;
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := coalesce(NEW.created_at, now()) + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_access_request_sla ON public.widget_access_requests;
CREATE TRIGGER set_access_request_sla
BEFORE INSERT OR UPDATE ON public.widget_access_requests
FOR EACH ROW EXECUTE FUNCTION public.set_access_request_sla();

-- Ages out stale pending requests so viewers can raise a fresh one.
CREATE OR REPLACE FUNCTION public.expire_widget_access_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.widget_access_requests
  SET status = 'expired',
      decision_note = coalesce(decision_note, 'Expired without a decision')
  WHERE company_id = public.current_company_id()
    AND status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_widget_access_requests() TO authenticated;

-- 2. Export action trail ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.export_action_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  surface text NOT NULL DEFAULT 'command-centre',
  format text,
  template_name text,
  template_version integer,
  sections text[] NOT NULL DEFAULT '{}',
  recipients text[] NOT NULL DEFAULT '{}',
  schedule_id uuid,
  run_id uuid,
  widget_id text,
  outcome text NOT NULL DEFAULT 'ok',
  detail text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.export_action_events TO authenticated;
GRANT ALL ON public.export_action_events TO service_role;

ALTER TABLE public.export_action_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read export actions"
ON public.export_action_events FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

CREATE POLICY "Workspace members log export actions"
ON public.export_action_events FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id());

CREATE INDEX IF NOT EXISTS export_action_events_company_created_idx
  ON public.export_action_events (company_id, created_at DESC);

-- 3. Retry metadata -----------------------------------------------------------
ALTER TABLE public.export_audit_events
  ADD COLUMN IF NOT EXISTS retry_of_id uuid,
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS auto_retry boolean NOT NULL DEFAULT false;

ALTER TABLE public.executive_report_schedules
  ADD COLUMN IF NOT EXISTS auto_retry boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_status text,
  ADD COLUMN IF NOT EXISTS last_error text;

-- 4. Shareable preset links ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.preset_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  preset_id uuid NOT NULL REFERENCES public.command_filter_presets(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  label text,
  allowed_roles app_role[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  revoked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.preset_share_links TO authenticated;
GRANT ALL ON public.preset_share_links TO service_role;

ALTER TABLE public.preset_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read share links"
ON public.preset_share_links FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

CREATE POLICY "Workspace members create share links"
ON public.preset_share_links FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id() AND created_by = auth.uid());

CREATE POLICY "Owners and admins update share links"
ON public.preset_share_links FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND (created_by = auth.uid() OR public.is_company_admin()))
WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "Owners and admins delete share links"
ON public.preset_share_links FOR DELETE TO authenticated
USING (company_id = public.current_company_id() AND (created_by = auth.uid() OR public.is_company_admin()));

CREATE TRIGGER preset_share_links_updated_at
BEFORE UPDATE ON public.preset_share_links
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Resolves a share token for the signed-in viewer, enforcing expiry, revocation
-- and the link's role restriction, and records the view.
CREATE OR REPLACE FUNCTION public.preset_by_share_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.preset_share_links%ROWTYPE;
  v_preset public.command_filter_presets%ROWTYPE;
BEGIN
  SELECT * INTO v_link FROM public.preset_share_links WHERE token = _token;
  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_link.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;
  IF v_link.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired', 'expiresAt', v_link.expires_at);
  END IF;
  IF array_length(v_link.allowed_roles, 1) IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = ANY (v_link.allowed_roles)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_preset FROM public.command_filter_presets WHERE id = v_link.preset_id;
  IF v_preset.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  UPDATE public.preset_share_links
  SET view_count = view_count + 1, last_viewed_at = now()
  WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'ok', true,
    'preset', jsonb_build_object(
      'id', v_preset.id,
      'name', v_preset.name,
      'description', v_preset.description,
      'filters', v_preset.filters,
      'scope', v_preset.scope
    ),
    'expiresAt', v_link.expires_at,
    'label', v_link.label
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preset_by_share_token(text) TO authenticated;