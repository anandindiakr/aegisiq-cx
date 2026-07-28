ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE TABLE IF NOT EXISTS public.alert_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT current_company_id(),
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_notes_alert_idx ON public.alert_notes (alert_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.alert_notes TO authenticated;
GRANT ALL ON public.alert_notes TO service_role;

ALTER TABLE public.alert_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members read alert notes" ON public.alert_notes;
CREATE POLICY "Tenant members read alert notes"
  ON public.alert_notes FOR SELECT TO authenticated
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS "Tenant members create alert notes" ON public.alert_notes;
CREATE POLICY "Tenant members create alert notes"
  ON public.alert_notes FOR INSERT TO authenticated
  WITH CHECK (company_id = current_company_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "Authors delete their alert notes" ON public.alert_notes;
CREATE POLICY "Authors delete their alert notes"
  ON public.alert_notes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cameras'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cameras';
  END IF;
END $$;