CREATE TABLE public.review_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  conversation_id uuid,
  assignment_id uuid,
  action text NOT NULL,
  actor_id uuid,
  actor_name text,
  changed_fields text[] NOT NULL DEFAULT '{}',
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.review_audit_events TO authenticated;
GRANT ALL ON public.review_audit_events TO service_role;

ALTER TABLE public.review_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read their audit trail"
ON public.review_audit_events
FOR SELECT
TO authenticated
USING (company_id = public.current_company_id() OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX review_audit_events_company_created_idx
  ON public.review_audit_events (company_id, created_at DESC);
CREATE INDEX review_audit_events_entity_idx
  ON public.review_audit_events (entity_type, entity_id);
CREATE INDEX review_audit_events_conversation_idx
  ON public.review_audit_events (conversation_id);

CREATE OR REPLACE FUNCTION public.actor_display_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT p.full_name FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
    'System'
  );
$$;

REVOKE ALL ON FUNCTION public.actor_display_name() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_conversation_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fields text[] := '{}';
  before_json jsonb := '{}'::jsonb;
  after_json jsonb := '{}'::jsonb;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    fields := fields || 'status';
    before_json := before_json || jsonb_build_object('status', OLD.status);
    after_json := after_json || jsonb_build_object('status', NEW.status);
  END IF;
  IF NEW.risk_level IS DISTINCT FROM OLD.risk_level THEN
    fields := fields || 'risk_level';
    before_json := before_json || jsonb_build_object('risk_level', OLD.risk_level);
    after_json := after_json || jsonb_build_object('risk_level', NEW.risk_level);
  END IF;
  IF NEW.escalated IS DISTINCT FROM OLD.escalated THEN
    fields := fields || 'escalated';
    before_json := before_json || jsonb_build_object('escalated', OLD.escalated);
    after_json := after_json || jsonb_build_object('escalated', NEW.escalated);
  END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    fields := fields || 'deleted_at';
    before_json := before_json || jsonb_build_object('deleted_at', OLD.deleted_at);
    after_json := after_json || jsonb_build_object('deleted_at', NEW.deleted_at);
  END IF;

  IF array_length(fields, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.review_audit_events (
    company_id, entity_type, entity_id, conversation_id, action,
    actor_id, actor_name, changed_fields, before_state, after_state
  ) VALUES (
    NEW.company_id, 'conversation', NEW.id, NEW.id, 'updated',
    auth.uid(), public.actor_display_name(), fields,
    before_json || jsonb_build_object('reference', OLD.reference),
    after_json || jsonb_build_object('reference', NEW.reference)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER conversations_audit
AFTER UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.log_conversation_audit();

CREATE OR REPLACE FUNCTION public.log_assignment_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fields text[] := '{}';
  before_json jsonb := '{}'::jsonb;
  after_json jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.review_audit_events (
      company_id, entity_type, entity_id, conversation_id, assignment_id, action,
      actor_id, actor_name, changed_fields, before_state, after_state
    ) VALUES (
      NEW.company_id, 'review_assignment', NEW.id, NEW.conversation_id, NEW.id, 'created',
      auth.uid(), public.actor_display_name(), ARRAY['status','assignee_id','priority','due_at'],
      '{}'::jsonb,
      jsonb_build_object(
        'title', NEW.title, 'status', NEW.status, 'priority', NEW.priority,
        'assignee_name', NEW.assignee_name, 'sla_minutes', NEW.sla_minutes, 'due_at', NEW.due_at
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.review_audit_events (
      company_id, entity_type, entity_id, conversation_id, assignment_id, action,
      actor_id, actor_name, changed_fields, before_state, after_state
    ) VALUES (
      OLD.company_id, 'review_assignment', OLD.id, OLD.conversation_id, OLD.id, 'removed',
      auth.uid(), public.actor_display_name(), ARRAY['status'],
      jsonb_build_object(
        'title', OLD.title, 'status', OLD.status, 'priority', OLD.priority,
        'assignee_name', OLD.assignee_name, 'due_at', OLD.due_at
      ),
      '{}'::jsonb
    );
    RETURN OLD;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    fields := fields || 'status';
    before_json := before_json || jsonb_build_object('status', OLD.status);
    after_json := after_json || jsonb_build_object('status', NEW.status);
  END IF;
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    fields := fields || 'assignee_id';
    before_json := before_json || jsonb_build_object('assignee_name', OLD.assignee_name);
    after_json := after_json || jsonb_build_object('assignee_name', NEW.assignee_name);
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    fields := fields || 'priority';
    before_json := before_json || jsonb_build_object('priority', OLD.priority);
    after_json := after_json || jsonb_build_object('priority', NEW.priority);
  END IF;
  IF NEW.sla_minutes IS DISTINCT FROM OLD.sla_minutes THEN
    fields := fields || 'sla_minutes';
    before_json := before_json || jsonb_build_object('sla_minutes', OLD.sla_minutes);
    after_json := after_json || jsonb_build_object('sla_minutes', NEW.sla_minutes);
  END IF;
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    fields := fields || 'due_at';
    before_json := before_json || jsonb_build_object('due_at', OLD.due_at);
    after_json := after_json || jsonb_build_object('due_at', NEW.due_at);
  END IF;

  IF array_length(fields, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.review_audit_events (
    company_id, entity_type, entity_id, conversation_id, assignment_id, action,
    actor_id, actor_name, changed_fields, before_state, after_state
  ) VALUES (
    NEW.company_id, 'review_assignment', NEW.id, NEW.conversation_id, NEW.id, 'updated',
    auth.uid(), public.actor_display_name(), fields,
    before_json || jsonb_build_object('title', OLD.title),
    after_json || jsonb_build_object('title', NEW.title)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER review_assignments_audit
AFTER INSERT OR UPDATE OR DELETE ON public.review_assignments
FOR EACH ROW EXECUTE FUNCTION public.log_assignment_audit();