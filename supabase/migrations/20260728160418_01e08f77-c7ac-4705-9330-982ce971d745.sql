CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS private.crypto_keys (
  name text PRIMARY KEY,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.crypto_keys (name, key)
VALUES ('device_credentials', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------- audit log
CREATE TABLE public.infra_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_name text,
  action text NOT NULL,
  actor_id uuid,
  actor_name text,
  changed_fields text[] NOT NULL DEFAULT '{}',
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.infra_audit_events TO authenticated;
GRANT ALL ON public.infra_audit_events TO service_role;

ALTER TABLE public.infra_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can read infra audit"
ON public.infra_audit_events FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

CREATE INDEX idx_infra_audit_company_created
  ON public.infra_audit_events (company_id, created_at DESC);
CREATE INDEX idx_infra_audit_entity
  ON public.infra_audit_events (entity_type, entity_id, created_at DESC);

-- ------------------------------------------------------------ audit trigger
CREATE OR REPLACE FUNCTION public.log_infra_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      'ram_gb','storage_gb','ip_address','location','status','agent_version','notes','deleted_at']
    ELSE ARRAY['name','provider','capability','enabled','status','api_configured','version','health',
      'endpoint','region','notes']
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

CREATE TRIGGER trg_cameras_audit
AFTER INSERT OR UPDATE OR DELETE ON public.cameras
FOR EACH ROW EXECUTE FUNCTION public.log_infra_change();

CREATE TRIGGER trg_gateways_audit
AFTER INSERT OR UPDATE OR DELETE ON public.edge_gateways
FOR EACH ROW EXECUTE FUNCTION public.log_infra_change();

CREATE TRIGGER trg_engines_audit
AFTER INSERT OR UPDATE OR DELETE ON public.ai_engines
FOR EACH ROW EXECUTE FUNCTION public.log_infra_change();

-- ----------------------------------------------------------- credentials
CREATE TABLE public.device_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  device_type text NOT NULL,
  device_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Primary',
  username text,
  secret_cipher bytea,
  onvif_username text,
  onvif_secret_cipher bytea,
  rtsp_url text,
  notes text,
  rotated_at timestamptz,
  last_revealed_at timestamptz,
  last_revealed_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_type, device_id, label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_credentials TO authenticated;
GRANT ALL ON public.device_credentials TO service_role;

ALTER TABLE public.device_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read device credential metadata"
ON public.device_credentials FOR SELECT TO authenticated
USING (company_id = public.current_company_id() AND public.can_operate());

CREATE POLICY "Admins insert device credentials"
ON public.device_credentials FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());

CREATE POLICY "Admins update device credentials"
ON public.device_credentials FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND public.is_company_admin())
WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());

CREATE POLICY "Admins delete device credentials"
ON public.device_credentials FOR DELETE TO authenticated
USING (company_id = public.current_company_id() AND public.is_company_admin());

CREATE TRIGGER trg_device_credentials_updated
BEFORE UPDATE ON public.device_credentials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.save_device_credential(
  _device_type text,
  _device_id uuid,
  _username text,
  _secret text,
  _onvif_username text DEFAULT NULL,
  _onvif_secret text DEFAULT NULL,
  _rtsp_url text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_key text;
  v_id uuid;
BEGIN
  IF v_company IS NULL OR NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'Only workspace admins may store device credentials';
  END IF;
  IF _device_type NOT IN ('camera','gateway') THEN
    RAISE EXCEPTION 'Unsupported device type: %', _device_type;
  END IF;

  SELECT key INTO v_key FROM private.crypto_keys WHERE name = 'device_credentials';

  INSERT INTO public.device_credentials AS dc (
    company_id, device_type, device_id, username, secret_cipher,
    onvif_username, onvif_secret_cipher, rtsp_url, notes, rotated_at, created_by
  ) VALUES (
    v_company, _device_type, _device_id, _username,
    CASE WHEN _secret IS NULL OR _secret = '' THEN NULL
         ELSE extensions.pgp_sym_encrypt(_secret, v_key) END,
    _onvif_username,
    CASE WHEN _onvif_secret IS NULL OR _onvif_secret = '' THEN NULL
         ELSE extensions.pgp_sym_encrypt(_onvif_secret, v_key) END,
    _rtsp_url, _notes, now(), auth.uid()
  )
  ON CONFLICT (device_type, device_id, label) DO UPDATE SET
    username = EXCLUDED.username,
    secret_cipher = coalesce(EXCLUDED.secret_cipher, dc.secret_cipher),
    onvif_username = EXCLUDED.onvif_username,
    onvif_secret_cipher = coalesce(EXCLUDED.onvif_secret_cipher, dc.onvif_secret_cipher),
    rtsp_url = EXCLUDED.rtsp_url,
    notes = EXCLUDED.notes,
    rotated_at = CASE WHEN EXCLUDED.secret_cipher IS NOT NULL THEN now() ELSE dc.rotated_at END
  RETURNING id INTO v_id;

  INSERT INTO public.infra_audit_events (
    company_id, entity_type, entity_id, entity_name, action, actor_id, actor_name,
    changed_fields, summary
  ) VALUES (
    v_company, _device_type || '_credential', _device_id, _username, 'credential_saved',
    auth.uid(), public.actor_display_name(), ARRAY['username','secret'],
    'Credentials stored for ' || _device_type || ' (encrypted at rest)'
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_device_credential(text,uuid,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_device_credential(text,uuid,text,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reveal_device_credential(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_key text;
  r public.device_credentials%ROWTYPE;
BEGIN
  IF v_company IS NULL OR NOT public.is_company_admin() THEN
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

REVOKE ALL ON FUNCTION public.reveal_device_credential(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reveal_device_credential(uuid) TO authenticated;