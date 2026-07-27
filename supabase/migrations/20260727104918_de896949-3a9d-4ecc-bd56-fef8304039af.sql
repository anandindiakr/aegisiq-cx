-- Conversation notes -------------------------------------------------------
CREATE TABLE public.conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  author_id uuid,
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversation_notes_conversation_idx ON public.conversation_notes(conversation_id);
CREATE INDEX conversation_notes_company_idx ON public.conversation_notes(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_notes TO authenticated;
GRANT ALL ON public.conversation_notes TO service_role;

ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes readable in tenant" ON public.conversation_notes
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "notes insert own" ON public.conversation_notes
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND author_id = auth.uid());
CREATE POLICY "notes update own" ON public.conversation_notes
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND (author_id = auth.uid() OR public.is_company_admin()))
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "notes delete own" ON public.conversation_notes
  FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND (author_id = auth.uid() OR public.is_company_admin()));

CREATE TRIGGER conversation_notes_set_updated_at
  BEFORE UPDATE ON public.conversation_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Conversation tags ---------------------------------------------------------
CREATE TABLE public.conversation_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, tag)
);
CREATE INDEX conversation_tags_company_idx ON public.conversation_tags(company_id);
CREATE INDEX conversation_tags_tag_idx ON public.conversation_tags(company_id, tag);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_tags TO authenticated;
GRANT ALL ON public.conversation_tags TO service_role;

ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags readable in tenant" ON public.conversation_tags
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "tags insert in tenant" ON public.conversation_tags
  FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "tags update in tenant" ON public.conversation_tags
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "tags delete in tenant" ON public.conversation_tags
  FOR DELETE TO authenticated USING (company_id = public.current_company_id());

CREATE TRIGGER conversation_tags_set_updated_at
  BEFORE UPDATE ON public.conversation_tags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Alert activity history ----------------------------------------------------
CREATE TABLE public.alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text,
  from_status alert_status,
  to_status alert_status NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alert_events_alert_idx ON public.alert_events(alert_id, created_at DESC);

GRANT SELECT, INSERT ON public.alert_events TO authenticated;
GRANT ALL ON public.alert_events TO service_role;

ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert events readable in tenant" ON public.alert_events
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "alert events insert in tenant" ON public.alert_events
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_operate());