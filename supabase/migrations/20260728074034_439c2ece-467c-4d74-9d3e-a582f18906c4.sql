CREATE TABLE public.copilot_report_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES public.copilot_report_runs(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'export',
  format text,
  filename text,
  channel text,
  destination text,
  status text NOT NULL DEFAULT 'ready',
  size_bytes integer,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX copilot_report_artifacts_run_idx ON public.copilot_report_artifacts (run_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.copilot_report_artifacts TO authenticated;
GRANT ALL ON public.copilot_report_artifacts TO service_role;

ALTER TABLE public.copilot_report_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own report artifacts"
  ON public.copilot_report_artifacts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users create their own report artifacts"
  ON public.copilot_report_artifacts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = current_company_id());

CREATE POLICY "Users delete their own report artifacts"
  ON public.copilot_report_artifacts FOR DELETE TO authenticated
  USING (user_id = auth.uid());