CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL UNIQUE,
  in_app_alerts boolean NOT NULL DEFAULT true,
  email_alerts boolean NOT NULL DEFAULT false,
  sla_in_app boolean NOT NULL DEFAULT true,
  sla_email boolean NOT NULL DEFAULT false,
  sla_frequency text NOT NULL DEFAULT 'immediate',
  digest_email text,
  quiet_hours_start smallint,
  quiet_hours_end smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own notification preferences"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users create their own notification preferences"
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());

CREATE POLICY "Users update their own notification preferences"
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete their own notification preferences"
  ON public.notification_preferences FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER set_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_sla_frequency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sla_frequency NOT IN ('immediate','hourly','daily','off') THEN
    RAISE EXCEPTION 'Invalid sla_frequency: %', NEW.sla_frequency;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_notification_preferences
  BEFORE INSERT OR UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.validate_sla_frequency();