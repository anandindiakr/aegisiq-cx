-- 1. Camera enterprise fields
ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS camera_code text,
  ADD COLUMN IF NOT EXISTS zone text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS port integer NOT NULL DEFAULT 554,
  ADD COLUMN IF NOT EXISTS stream_username text,
  ADD COLUMN IF NOT EXISTS https_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onvif_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS audio_codec text NOT NULL DEFAULT 'AAC',
  ADD COLUMN IF NOT EXISTS video_codec text NOT NULL DEFAULT 'H.264',
  ADD COLUMN IF NOT EXISTS resolution text NOT NULL DEFAULT '1920x1080',
  ADD COLUMN IF NOT EXISTS fps integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS bitrate_kbps integer NOT NULL DEFAULT 4096,
  ADD COLUMN IF NOT EXISTS mic_type text NOT NULL DEFAULT 'built_in',
  ADD COLUMN IF NOT EXISTS sampling_rate integer NOT NULL DEFAULT 16000,
  ADD COLUMN IF NOT EXISTS noise_reduction boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS echo_cancellation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS gain numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS health_score integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS health_state text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS gateway_id uuid;

CREATE INDEX IF NOT EXISTS cameras_gateway_idx ON public.cameras(gateway_id);

-- 2. Edge gateways
CREATE TABLE IF NOT EXISTS public.edge_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  serial_number text NOT NULL,
  operating_system text NOT NULL DEFAULT 'Ubuntu 22.04 LTS',
  cpu_model text NOT NULL DEFAULT 'Intel Xeon E-2388G',
  gpu_model text NOT NULL DEFAULT 'NVIDIA RTX A2000',
  ram_gb integer NOT NULL DEFAULT 32,
  storage_gb integer NOT NULL DEFAULT 1024,
  ip_address text,
  location text,
  outlet_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'online',
  cpu_usage numeric NOT NULL DEFAULT 0,
  memory_usage numeric NOT NULL DEFAULT 0,
  gpu_usage numeric NOT NULL DEFAULT 0,
  disk_usage numeric NOT NULL DEFAULT 0,
  temperature_c numeric NOT NULL DEFAULT 40,
  agent_version text NOT NULL DEFAULT '1.0.0',
  last_heartbeat_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edge_gateways TO authenticated;
GRANT ALL ON public.edge_gateways TO service_role;
ALTER TABLE public.edge_gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gateways_select" ON public.edge_gateways FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "gateways_insert" ON public.edge_gateways FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "gateways_update" ON public.edge_gateways FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_operate())
  WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "gateways_delete" ON public.edge_gateways FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER edge_gateways_updated_at BEFORE UPDATE ON public.edge_gateways
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. AI engines
CREATE TABLE IF NOT EXISTS public.ai_engines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  provider text NOT NULL,
  name text NOT NULL,
  capability text NOT NULL DEFAULT 'speech_to_text',
  enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'idle',
  api_configured boolean NOT NULL DEFAULT false,
  version text NOT NULL DEFAULT 'v1',
  health text NOT NULL DEFAULT 'unknown',
  latency_ms integer NOT NULL DEFAULT 0,
  endpoint text,
  region text,
  notes text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_tested_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_engines TO authenticated;
GRANT ALL ON public.ai_engines TO service_role;
ALTER TABLE public.ai_engines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engines_select" ON public.ai_engines FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "engines_insert" ON public.ai_engines FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "engines_update" ON public.ai_engines FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_operate())
  WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "engines_delete" ON public.ai_engines FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER ai_engines_updated_at BEFORE UPDATE ON public.ai_engines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Audio streams
CREATE TABLE IF NOT EXISTS public.audio_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  camera_id uuid NOT NULL,
  sampling_rate integer NOT NULL DEFAULT 16000,
  channels integer NOT NULL DEFAULT 1,
  codec text NOT NULL DEFAULT 'AAC',
  bitrate_kbps integer NOT NULL DEFAULT 64,
  noise_floor_db numeric NOT NULL DEFAULT -52,
  latency_ms integer NOT NULL DEFAULT 120,
  packet_loss numeric NOT NULL DEFAULT 0,
  signal_quality integer NOT NULL DEFAULT 90,
  status text NOT NULL DEFAULT 'streaming',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audio_streams_camera_idx ON public.audio_streams(camera_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audio_streams TO authenticated;
GRANT ALL ON public.audio_streams TO service_role;
ALTER TABLE public.audio_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audio_streams_select" ON public.audio_streams FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "audio_streams_insert" ON public.audio_streams FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "audio_streams_update" ON public.audio_streams FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_operate())
  WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "audio_streams_delete" ON public.audio_streams FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER audio_streams_updated_at BEFORE UPDATE ON public.audio_streams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Storage pools
CREATE TABLE IF NOT EXISTS public.storage_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'video',
  tier text NOT NULL DEFAULT 'hot',
  used_gb numeric NOT NULL DEFAULT 0,
  capacity_gb numeric NOT NULL DEFAULT 1024,
  retention_days integer NOT NULL DEFAULT 30,
  archive_enabled boolean NOT NULL DEFAULT false,
  archive_target text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_pools TO authenticated;
GRANT ALL ON public.storage_pools TO service_role;
ALTER TABLE public.storage_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "storage_pools_select" ON public.storage_pools FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "storage_pools_insert" ON public.storage_pools FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "storage_pools_update" ON public.storage_pools FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_operate())
  WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "storage_pools_delete" ON public.storage_pools FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER storage_pools_updated_at BEFORE UPDATE ON public.storage_pools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Infrastructure events (append-only live log)
CREATE TABLE IF NOT EXISTS public.infra_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'connection',
  level text NOT NULL DEFAULT 'info',
  device_type text,
  device_id uuid,
  device_name text,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS infra_events_created_idx ON public.infra_events(company_id, created_at DESC);
GRANT SELECT, INSERT ON public.infra_events TO authenticated;
GRANT ALL ON public.infra_events TO service_role;
ALTER TABLE public.infra_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "infra_events_select" ON public.infra_events FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "infra_events_insert" ON public.infra_events FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());