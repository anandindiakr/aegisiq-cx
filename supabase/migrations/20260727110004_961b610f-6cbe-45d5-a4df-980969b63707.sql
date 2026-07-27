-- Transcript anchors ---------------------------------------------------------
CREATE TABLE public.transcript_anchors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  transcript_id uuid REFERENCES public.transcripts(id) ON DELETE SET NULL,
  speaker text NOT NULL DEFAULT 'unknown',
  start_ms integer NOT NULL DEFAULT 0,
  end_ms integer NOT NULL DEFAULT 0,
  quote text NOT NULL,
  note text,
  labels text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcript_anchors TO authenticated;
GRANT ALL ON public.transcript_anchors TO service_role;
ALTER TABLE public.transcript_anchors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anchors_select" ON public.transcript_anchors
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "anchors_insert" ON public.transcript_anchors
  FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "anchors_update" ON public.transcript_anchors
  FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.can_operate())
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "anchors_delete" ON public.transcript_anchors
  FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.can_operate());

CREATE TRIGGER transcript_anchors_updated_at BEFORE UPDATE ON public.transcript_anchors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX transcript_anchors_conversation_idx ON public.transcript_anchors (company_id, conversation_id, start_ms);

-- Reviewer queue --------------------------------------------------------------
CREATE TYPE public.review_queue_status AS ENUM ('open', 'in_progress', 'done', 'cancelled');
CREATE TYPE public.review_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE public.review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  alert_id uuid REFERENCES public.alerts(id) ON DELETE CASCADE,
  title text NOT NULL,
  assignee_id uuid,
  assignee_name text,
  status public.review_queue_status NOT NULL DEFAULT 'open',
  priority public.review_priority NOT NULL DEFAULT 'normal',
  sla_minutes integer NOT NULL DEFAULT 240,
  due_at timestamptz NOT NULL DEFAULT now() + interval '4 hours',
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_assignments TO authenticated;
GRANT ALL ON public.review_assignments TO service_role;
ALTER TABLE public.review_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_select" ON public.review_assignments
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "queue_insert" ON public.review_assignments
  FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.can_operate());
CREATE POLICY "queue_update" ON public.review_assignments
  FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.can_operate())
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "queue_delete" ON public.review_assignments
  FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.can_operate());

CREATE TRIGGER review_assignments_updated_at BEFORE UPDATE ON public.review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX review_assignments_queue_idx ON public.review_assignments (company_id, status, due_at);
CREATE INDEX review_assignments_assignee_idx ON public.review_assignments (company_id, assignee_id);
CREATE UNIQUE INDEX review_assignments_alert_unique ON public.review_assignments (alert_id) WHERE alert_id IS NOT NULL;

-- Search indexes ---------------------------------------------------------------
CREATE INDEX conversation_notes_fts_idx ON public.conversation_notes
  USING gin (to_tsvector('english', coalesce(body, '')));
CREATE INDEX IF NOT EXISTS conversation_tags_company_tag_idx ON public.conversation_tags (company_id, tag);
CREATE INDEX transcript_anchors_fts_idx ON public.transcript_anchors
  USING gin (to_tsvector('english', coalesce(quote, '') || ' ' || coalesce(note, '')));