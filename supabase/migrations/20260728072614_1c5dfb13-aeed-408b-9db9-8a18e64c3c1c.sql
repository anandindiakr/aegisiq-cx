CREATE TABLE public.copilot_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  command text NOT NULL,
  intent text NOT NULL DEFAULT 'executive_report',
  input_mode text NOT NULL DEFAULT 'text',
  range_label text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'running',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  partial jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.copilot_report_runs TO authenticated;
GRANT ALL ON public.copilot_report_runs TO service_role;

ALTER TABLE public.copilot_report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own copilot report runs"
  ON public.copilot_report_runs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users create their own copilot report runs"
  ON public.copilot_report_runs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());

CREATE POLICY "Users update their own copilot report runs"
  ON public.copilot_report_runs FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX copilot_report_runs_user_idx
  ON public.copilot_report_runs (user_id, started_at DESC);

CREATE TRIGGER copilot_report_runs_updated_at
  BEFORE UPDATE ON public.copilot_report_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();