
-- 1. Admin settings store -------------------------------------------------
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  section text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, section)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_settings_select" ON public.admin_settings FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "admin_settings_insert" ON public.admin_settings FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "admin_settings_update" ON public.admin_settings FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "admin_settings_delete" ON public.admin_settings FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER admin_settings_updated_at BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Integration connections ----------------------------------------------
CREATE TABLE public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  provider text NOT NULL,
  category text NOT NULL DEFAULT 'messaging',
  enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'not_configured',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT ALL ON public.integration_connections TO service_role;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations_select" ON public.integration_connections FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "integrations_insert" ON public.integration_connections FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "integrations_update" ON public.integration_connections FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "integrations_delete" ON public.integration_connections FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER integrations_updated_at BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Encrypted API credentials --------------------------------------------
CREATE TABLE public.api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  provider text NOT NULL,
  label text,
  secret_cipher bytea,
  hint text,
  rotated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  last_revealed_at timestamptz,
  last_revealed_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_credentials TO authenticated;
GRANT ALL ON public.api_credentials TO service_role;
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;
-- Cipher text is never selectable by clients: reads go through reveal_api_credential.
CREATE POLICY "api_credentials_select" ON public.api_credentials FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "api_credentials_delete" ON public.api_credentials FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER api_credentials_updated_at BEFORE UPDATE ON public.api_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.save_api_credential(
  _provider text, _label text, _secret text, _expires_at timestamptz DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_key text;
  v_id uuid;
BEGIN
  IF v_company IS NULL OR NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'Only workspace admins may store API keys';
  END IF;
  SELECT key INTO v_key FROM private.crypto_keys WHERE name = 'device_credentials';

  INSERT INTO public.api_credentials (
    company_id, provider, label, secret_cipher, hint, expires_at, created_by, rotated_at
  ) VALUES (
    v_company, _provider, _label,
    CASE WHEN _secret IS NULL OR _secret = '' THEN NULL
         ELSE extensions.pgp_sym_encrypt(_secret, v_key) END,
    CASE WHEN _secret IS NULL OR _secret = '' THEN NULL
         ELSE '••••' || right(_secret, 4) END,
    _expires_at, auth.uid(), now()
  )
  ON CONFLICT (company_id, provider) DO UPDATE SET
    label = EXCLUDED.label,
    secret_cipher = COALESCE(EXCLUDED.secret_cipher, public.api_credentials.secret_cipher),
    hint = COALESCE(EXCLUDED.hint, public.api_credentials.hint),
    expires_at = EXCLUDED.expires_at,
    rotated_at = CASE WHEN EXCLUDED.secret_cipher IS NULL
                      THEN public.api_credentials.rotated_at ELSE now() END
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (company_id, entity_type, entity_id, action, actor_id, actor_name, metadata)
  VALUES (v_company, 'api_credential', v_id, 'api_key_saved', auth.uid(),
          public.actor_display_name(), jsonb_build_object('provider', _provider));

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reveal_api_credential(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_key text;
  r public.api_credentials%ROWTYPE;
BEGIN
  IF v_company IS NULL OR NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'Only workspace admins may reveal API keys';
  END IF;
  SELECT * INTO r FROM public.api_credentials WHERE id = _id AND company_id = v_company;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Credential not found'; END IF;

  SELECT key INTO v_key FROM private.crypto_keys WHERE name = 'device_credentials';

  UPDATE public.api_credentials
  SET last_revealed_at = now(), last_revealed_by = auth.uid() WHERE id = _id;

  INSERT INTO public.audit_logs (company_id, entity_type, entity_id, action, actor_id, actor_name, metadata)
  VALUES (v_company, 'api_credential', _id, 'api_key_revealed', auth.uid(),
          public.actor_display_name(), jsonb_build_object('provider', r.provider));

  RETURN jsonb_build_object(
    'provider', r.provider,
    'secret', CASE WHEN r.secret_cipher IS NULL THEN NULL
                   ELSE extensions.pgp_sym_decrypt(r.secret_cipher, v_key) END
  );
END;
$$;

-- 4. Backups ---------------------------------------------------------------
CREATE TABLE public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  kind text NOT NULL DEFAULT 'manual',
  scope text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'completed',
  size_mb numeric NOT NULL DEFAULT 0,
  retention_days integer NOT NULL DEFAULT 30,
  archive_location text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_runs_select" ON public.backup_runs FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "backup_runs_insert" ON public.backup_runs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "backup_runs_update" ON public.backup_runs FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "backup_runs_delete" ON public.backup_runs FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER backup_runs_updated_at BEFORE UPDATE ON public.backup_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Language capability matrix -------------------------------------------
ALTER TABLE public.languages
  ADD COLUMN IF NOT EXISTS speech_recognition boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS translation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sentiment boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS keyword_dictionary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'supported';

-- 6. Configuration audit trail --------------------------------------------
CREATE OR REPLACE FUNCTION public.log_admin_config_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_entity text := TG_ARGV[0];
  v_label text;
BEGIN
  v_label := CASE v_entity
    WHEN 'admin_setting' THEN NEW.section
    WHEN 'integration' THEN NEW.provider
    ELSE v_entity END;

  INSERT INTO public.audit_logs (company_id, entity_type, entity_id, action, actor_id, actor_name, metadata)
  VALUES (
    NEW.company_id, v_entity, NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'configuration_created' ELSE 'configuration_updated' END,
    auth.uid(), public.actor_display_name(),
    jsonb_build_object('name', v_label)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER admin_settings_audit AFTER INSERT OR UPDATE ON public.admin_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_config_change('admin_setting');
CREATE TRIGGER integrations_audit AFTER INSERT OR UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_config_change('integration');
