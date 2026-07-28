CREATE OR REPLACE FUNCTION public.sync_alert_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pol public.alert_sla_policies%ROWTYPE;
BEGIN
  IF NEW.status IN ('resolved','dismissed') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
    NEW.resolved_by := auth.uid();
  END IF;
  IF NEW.status = 'open' THEN
    NEW.resolved_at := NULL;
    NEW.resolved_by := NULL;
  END IF;
  IF NEW.status IN ('acknowledged','resolved','dismissed') AND NEW.acknowledged_at IS NULL THEN
    NEW.acknowledged_at := now();
  END IF;

  SELECT * INTO pol FROM public.alert_sla_policies
   WHERE company_id = NEW.company_id AND severity = NEW.severity AND is_active;

  IF pol.id IS NOT NULL THEN
    NEW.sla_due_at := NEW.triggered_at + (
      CASE WHEN NEW.acknowledged_at IS NULL THEN pol.ack_minutes ELSE pol.resolve_minutes END
      || ' minutes')::interval;
    IF NEW.status IN ('resolved','dismissed') THEN
      NEW.sla_breached := coalesce(NEW.resolved_at, now())
        > NEW.triggered_at + (pol.resolve_minutes || ' minutes')::interval;
    ELSE
      NEW.sla_breached := now() > NEW.sla_due_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;