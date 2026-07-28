-- 1. Gateway service switches -------------------------------------------------
ALTER TABLE public.edge_gateways
  ADD COLUMN IF NOT EXISTS ingest_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS transcription_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS diarization_enabled boolean NOT NULL DEFAULT true;

-- 2. Credential rotation tracking ---------------------------------------------
ALTER TABLE public.device_credentials
  ADD COLUMN IF NOT EXISTS rotation_interval_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS rotation_status text NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS rotation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS rotation_requested_by uuid,
  ADD COLUMN IF NOT EXISTS rotation_note text;

UPDATE public.device_credentials
SET expires_at = coalesce(rotated_at, created_at) + interval '90 days'
WHERE expires_at IS NULL;

-- 3. Granular infrastructure permissions --------------------------------------
CREATE OR REPLACE FUNCTION public.infra_can(_action text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE _action
    WHEN 'view' THEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    WHEN 'request_rotation' THEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    WHEN 'operate' THEN public.has_role(auth.uid(),'super_admin')
                     OR public.has_role(auth.uid(),'tenant_admin')
                     OR public.has_role(auth.uid(),'regional_manager')
                     OR public.has_role(auth.uid(),'outlet_manager')
                     OR public.has_role(auth.uid(),'supervisor')
    WHEN 'decommission' THEN public.has_role(auth.uid(),'super_admin')
                     OR public.has_role(auth.uid(),'tenant_admin')
                     OR public.has_role(auth.uid(),'regional_manager')
    WHEN 'reveal_credentials' THEN public.is_company_admin()
    WHEN 'manage_credentials' THEN public.is_company_admin()
    WHEN 'configure_thresholds' THEN public.is_company_admin()
    ELSE false
  END;
$$;

-- 4. Configurable health thresholds -------------------------------------------
CREATE TABLE IF NOT EXISTS public.infra_health_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  metric text NOT NULL,
  label text NOT NULL,
  unit text NOT NULL DEFAULT '',
  comparator text NOT NULL DEFAULT 'above',
  warn_value numeric NOT NULL,
  critical_value numeric NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, metric)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.infra_health_thresholds TO authenticated;
GRANT ALL ON public.infra_health_thresholds TO service_role;

ALTER TABLE public.infra_health_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read thresholds"
  ON public.infra_health_thresholds FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Admins insert thresholds"
  ON public.infra_health_thresholds FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.infra_can('configure_thresholds'));

CREATE POLICY "Admins update thresholds"
  ON public.infra_health_thresholds FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.infra_can('configure_thresholds'))
  WITH CHECK (company_id = public.current_company_id() AND public.infra_can('configure_thresholds'));

CREATE POLICY "Admins delete thresholds"
  ON public.infra_health_thresholds FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.infra_can('configure_thresholds'));

CREATE TRIGGER infra_health_thresholds_updated_at
  BEFORE UPDATE ON public.infra_health_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.infra_health_thresholds (company_id, metric, label, unit, comparator, warn_value, critical_value)
SELECT c.id, v.metric, v.label, v.unit, v.comparator, v.warn_value, v.critical_value
FROM public.companies c
CROSS JOIN (VALUES
  ('latency_ms','Stream latency','ms','above',250,450),
  ('packet_loss','Packet loss','%','above',1.5,4),
  ('noise_floor_db','Noise floor','dB','above',-40,-30),
  ('signal_quality','Signal quality','%','below',70,50)
) AS v(metric,label,unit,comparator,warn_value,critical_value)
ON CONFLICT (company_id, metric) DO NOTHING;

-- 5. Automated breach detection -> in-app alerts -------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_infra_health()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  r record;
  t record;
  v_value numeric;
  v_breach text;
  n integer := 0;
BEGIN
  IF v_company IS NULL THEN RETURN 0; END IF;

  FOR r IN
    SELECT s.id, s.latency_ms, s.packet_loss, s.noise_floor_db, s.signal_quality,
           cam.name AS camera_name, cam.outlet_id
    FROM public.audio_streams s
    JOIN public.cameras cam ON cam.id = s.camera_id
    WHERE s.company_id = v_company AND cam.deleted_at IS NULL
  LOOP
    FOR t IN
      SELECT * FROM public.infra_health_thresholds
      WHERE company_id = v_company AND enabled
    LOOP
      v_value := CASE t.metric
        WHEN 'latency_ms' THEN r.latency_ms
        WHEN 'packet_loss' THEN r.packet_loss
        WHEN 'noise_floor_db' THEN r.noise_floor_db
        WHEN 'signal_quality' THEN r.signal_quality
        ELSE NULL END;
      IF v_value IS NULL THEN CONTINUE; END IF;

      v_breach := NULL;
      IF t.comparator = 'above' THEN
        IF v_value >= t.critical_value THEN v_breach := 'critical';
        ELSIF v_value >= t.warn_value THEN v_breach := 'warn'; END IF;
      ELSE
        IF v_value <= t.critical_value THEN v_breach := 'critical';
        ELSIF v_value <= t.warn_value THEN v_breach := 'warn'; END IF;
      END IF;

      IF v_breach IS NULL THEN CONTINUE; END IF;

      IF EXISTS (
        SELECT 1 FROM public.alerts a
        WHERE a.company_id = v_company
          AND a.category = 'device_health'
          AND a.deleted_at IS NULL
          AND a.title = r.camera_name || ' — ' || t.label || ' threshold breached'
          AND a.triggered_at > now() - interval '1 hour'
      ) THEN CONTINUE; END IF;

      INSERT INTO public.alerts (
        company_id, outlet_id, title, description, category, severity, status, triggered_at
      ) VALUES (
        v_company, r.outlet_id,
        r.camera_name || ' — ' || t.label || ' threshold breached',
        t.label || ' measured ' || round(v_value, 2) || t.unit || ' against a '
          || CASE WHEN v_breach = 'critical' THEN 'critical' ELSE 'warning' END
          || ' limit of '
          || round(CASE WHEN v_breach = 'critical' THEN t.critical_value ELSE t.warn_value END, 2)
          || t.unit || '.',
        'device_health',
        CASE WHEN v_breach = 'critical' THEN 'critical'::alert_severity ELSE 'high'::alert_severity END,
        'open'::alert_status, now()
      );

      INSERT INTO public.infra_events (company_id, source, level, device_type, device_name, message)
      VALUES (v_company, 'health-monitor',
        CASE WHEN v_breach = 'critical' THEN 'error' ELSE 'warn' END,
        'camera', r.camera_name,
        t.label || ' breach on ' || r.camera_name || ' (' || round(v_value, 2) || t.unit || ')');

      n := n + 1;
    END LOOP;
  END LOOP;

  RETURN n;
END;
$$;

-- 6. Credential rotation request ------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_credential_rotation(_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  r public.device_credentials%ROWTYPE;
BEGIN
  IF v_company IS NULL OR NOT public.infra_can('request_rotation') THEN
    RAISE EXCEPTION 'You do not have permission to request a credential rotation';
  END IF;

  SELECT * INTO r FROM public.device_credentials WHERE id = _id AND company_id = v_company;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Credential not found'; END IF;

  UPDATE public.device_credentials
  SET rotation_status = 'rotation_requested',
      rotation_requested_at = now(),
      rotation_requested_by = auth.uid(),
      rotation_note = _note
  WHERE id = _id;

  INSERT INTO public.infra_audit_events (
    company_id, entity_type, entity_id, entity_name, action, actor_id, actor_name,
    changed_fields, before_state, after_state, summary
  ) VALUES (
    v_company, r.device_type || '_credential', r.device_id, r.username, 'credential_rotation_requested',
    auth.uid(), public.actor_display_name(), ARRAY['rotation_status'],
    jsonb_build_object('rotation_status', r.rotation_status),
    jsonb_build_object('rotation_status', 'rotation_requested'),
    'Rotation requested for ' || r.device_type || ' credential'
      || coalesce(' — ' || _note, '')
  );
END;
$$;

-- 7. Rotation-aware credential save ---------------------------------------------
CREATE OR REPLACE FUNCTION public.save_device_credential(
  _device_type text, _device_id uuid, _username text, _secret text,
  _onvif_username text DEFAULT NULL::text, _onvif_secret text DEFAULT NULL::text,
  _rtsp_url text DEFAULT NULL::text, _notes text DEFAULT NULL::text,
  _rotation_interval_days integer DEFAULT 90)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_key text;
  v_id uuid;
  v_interval integer := greatest(1, least(365, coalesce(_rotation_interval_days, 90)));
BEGIN
  IF v_company IS NULL OR NOT public.infra_can('manage_credentials') THEN
    RAISE EXCEPTION 'Only workspace admins may store device credentials';
  END IF;
  IF _device_type NOT IN ('camera','gateway') THEN
    RAISE EXCEPTION 'Unsupported device type: %', _device_type;
  END IF;

  SELECT key INTO v_key FROM private.crypto_keys WHERE name = 'device_credentials';

  INSERT INTO public.device_credentials AS dc (
    company_id, device_type, device_id, username, secret_cipher,
    onvif_username, onvif_secret_cipher, rtsp_url, notes, rotated_at, created_by,
    rotation_interval_days, expires_at, rotation_status, rotation_requested_at, rotation_requested_by
  ) VALUES (
    v_company, _device_type, _device_id, _username,
    CASE WHEN _secret IS NULL OR _secret = '' THEN NULL
         ELSE extensions.pgp_sym_encrypt(_secret, v_key) END,
    _onvif_username,
    CASE WHEN _onvif_secret IS NULL OR _onvif_secret = '' THEN NULL
         ELSE extensions.pgp_sym_encrypt(_onvif_secret, v_key) END,
    _rtsp_url, _notes, now(), auth.uid(),
    v_interval, now() + (v_interval || ' days')::interval, 'current', NULL, NULL
  )
  ON CONFLICT (device_type, device_id, label) DO UPDATE SET
    username = EXCLUDED.username,
    secret_cipher = coalesce(EXCLUDED.secret_cipher, dc.secret_cipher),
    onvif_username = EXCLUDED.onvif_username,
    onvif_secret_cipher = coalesce(EXCLUDED.onvif_secret_cipher, dc.onvif_secret_cipher),
    rtsp_url = EXCLUDED.rtsp_url,
    notes = EXCLUDED.notes,
    rotation_interval_days = EXCLUDED.rotation_interval_days,
    rotated_at = CASE WHEN EXCLUDED.secret_cipher IS NOT NULL THEN now() ELSE dc.rotated_at END,
    expires_at = CASE WHEN EXCLUDED.secret_cipher IS NOT NULL
                      THEN now() + (EXCLUDED.rotation_interval_days || ' days')::interval
                      ELSE coalesce(dc.rotated_at, now()) + (EXCLUDED.rotation_interval_days || ' days')::interval END,
    rotation_status = CASE WHEN EXCLUDED.secret_cipher IS NOT NULL THEN 'current' ELSE dc.rotation_status END,
    rotation_requested_at = CASE WHEN EXCLUDED.secret_cipher IS NOT NULL THEN NULL ELSE dc.rotation_requested_at END,
    rotation_requested_by = CASE WHEN EXCLUDED.secret_cipher IS NOT NULL THEN NULL ELSE dc.rotation_requested_by END
  RETURNING id INTO v_id;

  INSERT INTO public.infra_audit_events (
    company_id, entity_type, entity_id, entity_name, action, actor_id, actor_name,
    changed_fields, summary
  ) VALUES (
    v_company, _device_type || '_credential', _device_id, _username,
    CASE WHEN _secret IS NULL OR _secret = '' THEN 'credential_saved' ELSE 'credential_rotated' END,
    auth.uid(), public.actor_display_name(), ARRAY['username','secret','expires_at'],
    'Credentials stored for ' || _device_type || ' (encrypted at rest, next rotation in '
      || v_interval || ' days)'
  );

  RETURN v_id;
END;
$$;

-- 8. Reveal stays admin-only but uses the granular permission helper -------------
CREATE OR REPLACE FUNCTION public.reveal_device_credential(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_key text;
  r public.device_credentials%ROWTYPE;
BEGIN
  IF v_company IS NULL OR NOT public.infra_can('reveal_credentials') THEN
    RAISE EXCEPTION 'Only workspace admins may reveal device credentials';
  END IF;

  SELECT * INTO r FROM public.device_credentials WHERE id = _id AND company_id = v_company;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Credential not found'; END IF;

  SELECT key INTO v_key FROM private.crypto_keys WHERE name = 'device_credentials';

  UPDATE public.device_credentials
  SET last_revealed_at = now(), last_revealed_by = auth.uid()
  WHERE id = _id;

  INSERT INTO public.infra_audit_events (
    company_id, entity_type, entity_id, entity_name, action, actor_id, actor_name,
    changed_fields, summary
  ) VALUES (
    v_company, r.device_type || '_credential', r.device_id, r.username, 'credential_revealed',
    auth.uid(), public.actor_display_name(), ARRAY['secret'],
    'Credential revealed for ' || r.device_type
      || CASE WHEN r.expires_at IS NOT NULL AND r.expires_at < now() THEN ' (expired credential)' ELSE '' END
  );

  RETURN jsonb_build_object(
    'username', r.username,
    'secret', CASE WHEN r.secret_cipher IS NULL THEN NULL
                   ELSE extensions.pgp_sym_decrypt(r.secret_cipher, v_key) END,
    'onvif_username', r.onvif_username,
    'onvif_secret', CASE WHEN r.onvif_secret_cipher IS NULL THEN NULL
                         ELSE extensions.pgp_sym_decrypt(r.onvif_secret_cipher, v_key) END,
    'rtsp_url', r.rtsp_url
  );
END;
$$;

-- 9. Track the new gateway service switches in the change history ----------------
CREATE OR REPLACE FUNCTION public.log_infra_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tracked text[];
  f text;
  fields text[] := '{}';
  before_json jsonb := '{}'::jsonb;
  after_json jsonb := '{}'::jsonb;
  old_row jsonb;
  new_row jsonb;
  v_action text;
  v_name text;
  v_company uuid;
BEGIN
  tracked := CASE TG_TABLE_NAME
    WHEN 'cameras' THEN ARRAY['name','camera_code','outlet_id','gateway_id','zone','brand','model',
      'ip_address','port','rtsp_url','stream_username','https_enabled','onvif_enabled','audio_enabled',
      'audio_codec','video_codec','resolution','fps','bitrate_kbps','mic_type','sampling_rate',
      'noise_reduction','echo_cancellation','gain','status','health_state','firmware','deleted_at']
    WHEN 'edge_gateways' THEN ARRAY['name','serial_number','operating_system','cpu_model','gpu_model',
      'ram_gb','storage_gb','ip_address','location','status','agent_version','notes','deleted_at',
      'ingest_enabled','transcription_enabled','diarization_enabled']
    ELSE ARRAY['name','provider','capability','enabled','status','api_configured','version','health',
      'endpoint','region','notes','latency_ms']
  END;

  IF TG_OP = 'DELETE' THEN
    old_row := to_jsonb(OLD); new_row := '{}'::jsonb;
  ELSIF TG_OP = 'INSERT' THEN
    old_row := '{}'::jsonb; new_row := to_jsonb(NEW);
  ELSE
    old_row := to_jsonb(OLD); new_row := to_jsonb(NEW);
  END IF;

  v_company := coalesce((new_row->>'company_id')::uuid, (old_row->>'company_id')::uuid);
  v_name := coalesce(new_row->>'name', old_row->>'name');

  IF TG_OP = 'UPDATE' THEN
    FOREACH f IN ARRAY tracked LOOP
      IF (old_row->f) IS DISTINCT FROM (new_row->f) THEN
        fields := fields || f;
        before_json := before_json || jsonb_build_object(f, old_row->f);
        after_json := after_json || jsonb_build_object(f, new_row->f);
      END IF;
    END LOOP;
    IF array_length(fields, 1) IS NULL THEN RETURN NEW; END IF;
    IF (old_row->>'deleted_at') IS NULL AND (new_row->>'deleted_at') IS NOT NULL THEN
      v_action := 'decommissioned';
    ELSE
      v_action := 'updated';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_action := 'created';
    FOREACH f IN ARRAY tracked LOOP
      IF (new_row->f) IS NOT NULL THEN
        fields := fields || f;
        after_json := after_json || jsonb_build_object(f, new_row->f);
      END IF;
    END LOOP;
  ELSE
    v_action := 'deleted';
    fields := ARRAY['deleted'];
    before_json := jsonb_build_object('name', v_name);
  END IF;

  INSERT INTO public.infra_audit_events (
    company_id, entity_type, entity_id, entity_name, action, actor_id, actor_name,
    changed_fields, before_state, after_state, summary
  ) VALUES (
    v_company,
    CASE TG_TABLE_NAME WHEN 'cameras' THEN 'camera'
                       WHEN 'edge_gateways' THEN 'gateway'
                       ELSE 'ai_engine' END,
    coalesce((new_row->>'id')::uuid, (old_row->>'id')::uuid),
    v_name, v_action, auth.uid(), public.actor_display_name(),
    fields, before_json, after_json,
    v_name || ' ' || v_action ||
      CASE WHEN array_length(fields,1) IS NULL OR v_action <> 'updated' THEN ''
           ELSE ' (' || array_to_string(fields, ', ') || ')' END
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;