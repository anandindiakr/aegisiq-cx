CREATE TABLE public.copilot_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  favorite_outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  favorite_reports text[] NOT NULL DEFAULT '{}',
  pinned_dashboards text[] NOT NULL DEFAULT '{}',
  recent_searches text[] NOT NULL DEFAULT '{}',
  favorite_commands text[] NOT NULL DEFAULT '{}',
  default_language text NOT NULL DEFAULT 'en-GB',
  voice_enabled boolean NOT NULL DEFAULT true,
  speech_rate numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_preferences TO authenticated;
GRANT ALL ON public.copilot_preferences TO service_role;

ALTER TABLE public.copilot_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own copilot preferences" ON public.copilot_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());

CREATE POLICY "Users insert own copilot preferences" ON public.copilot_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());

CREATE POLICY "Users update own copilot preferences" ON public.copilot_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id())
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());

CREATE POLICY "Users delete own copilot preferences" ON public.copilot_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.current_company_id());

CREATE TRIGGER copilot_preferences_updated_at
  BEFORE UPDATE ON public.copilot_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.copilot_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  actor_id uuid DEFAULT auth.uid(),
  actor_name text,
  command text NOT NULL,
  intent text NOT NULL DEFAULT 'unknown',
  input_mode text NOT NULL DEFAULT 'text',
  surface text NOT NULL DEFAULT 'global',
  route text,
  resolved_entities jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text NOT NULL DEFAULT 'answered',
  denied_reason text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX copilot_audit_events_company_created_idx
  ON public.copilot_audit_events (company_id, created_at DESC);

GRANT SELECT, INSERT ON public.copilot_audit_events TO authenticated;
GRANT ALL ON public.copilot_audit_events TO service_role;

ALTER TABLE public.copilot_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins review copilot usage" ON public.copilot_audit_events
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_company_admin() OR actor_id = auth.uid())
  );

CREATE POLICY "Users log own copilot usage" ON public.copilot_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND actor_id = auth.uid());