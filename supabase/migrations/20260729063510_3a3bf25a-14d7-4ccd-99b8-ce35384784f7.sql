
-- 1. Daily usage counters -------------------------------------------------
CREATE TABLE public.usage_daily_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT current_date,
  copilot_queries integer NOT NULL DEFAULT 0,
  audio_minutes numeric NOT NULL DEFAULT 0,
  storage_gb numeric NOT NULL DEFAULT 0,
  egress_gb numeric NOT NULL DEFAULT 0,
  ai_tokens bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usage_daily_counters_key
  ON public.usage_daily_counters (company_id, usage_date, coalesce(outlet_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX usage_daily_counters_date ON public.usage_daily_counters (company_id, usage_date DESC);

GRANT SELECT ON public.usage_daily_counters TO authenticated;
GRANT ALL ON public.usage_daily_counters TO service_role;
ALTER TABLE public.usage_daily_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read daily usage" ON public.usage_daily_counters
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());

CREATE TRIGGER usage_daily_counters_updated_at BEFORE UPDATE ON public.usage_daily_counters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Alert rules -----------------------------------------------------------
CREATE TABLE public.usage_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  metric text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  warn_pct integer NOT NULL DEFAULT 80,
  critical_pct integer NOT NULL DEFAULT 100,
  spike_multiplier numeric NOT NULL DEFAULT 3.0,
  min_baseline numeric NOT NULL DEFAULT 20,
  notify_tenant_admins boolean NOT NULL DEFAULT true,
  notify_super_admin boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, metric),
  CONSTRAINT usage_alert_rules_metric_chk
    CHECK (metric IN ('copilot_queries','audio_minutes','storage_gb','egress_gb'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_alert_rules TO authenticated;
GRANT ALL ON public.usage_alert_rules TO service_role;
ALTER TABLE public.usage_alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read usage rules" ON public.usage_alert_rules
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "Admins insert usage rules" ON public.usage_alert_rules
  FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "Admins update usage rules" ON public.usage_alert_rules
  FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "Admins delete usage rules" ON public.usage_alert_rules
  FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER usage_alert_rules_updated_at BEFORE UPDATE ON public.usage_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Alert events ----------------------------------------------------------
CREATE TABLE public.usage_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  outlet_name text,
  metric text NOT NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  scope text NOT NULL DEFAULT 'tenant',
  observed numeric NOT NULL DEFAULT 0,
  baseline numeric,
  limit_value numeric,
  pct numeric,
  message text NOT NULL,
  dedupe_key text NOT NULL,
  notified_channels text[] NOT NULL DEFAULT '{}',
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, dedupe_key),
  CONSTRAINT usage_alert_events_kind_chk CHECK (kind IN ('threshold','throttle','anomaly')),
  CONSTRAINT usage_alert_events_sev_chk CHECK (severity IN ('info','warning','critical'))
);
CREATE INDEX usage_alert_events_recent ON public.usage_alert_events (company_id, created_at DESC);
GRANT SELECT, UPDATE ON public.usage_alert_events TO authenticated;
GRANT ALL ON public.usage_alert_events TO service_role;
ALTER TABLE public.usage_alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read usage events" ON public.usage_alert_events
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "Admins acknowledge usage events" ON public.usage_alert_events
  FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_admin());

-- 4. Scheduled usage reports ----------------------------------------------
CREATE TABLE public.usage_report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly',
  scope text NOT NULL DEFAULT 'outlet',
  format text NOT NULL DEFAULT 'csv',
  recipients text[] NOT NULL DEFAULT '{}',
  send_hour integer NOT NULL DEFAULT 7,
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  last_status text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usage_report_frequency_chk CHECK (frequency IN ('daily','weekly','monthly')),
  CONSTRAINT usage_report_scope_chk CHECK (scope IN ('tenant','outlet')),
  CONSTRAINT usage_report_format_chk CHECK (format IN ('csv'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_report_schedules TO authenticated;
GRANT ALL ON public.usage_report_schedules TO service_role;
ALTER TABLE public.usage_report_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read usage schedules" ON public.usage_report_schedules
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "Admins insert usage schedules" ON public.usage_report_schedules
  FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "Admins update usage schedules" ON public.usage_report_schedules
  FOR UPDATE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE POLICY "Admins delete usage schedules" ON public.usage_report_schedules
  FOR DELETE TO authenticated USING (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER usage_report_schedules_updated_at BEFORE UPDATE ON public.usage_report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. record_usage also writes the daily rollup -----------------------------
CREATE OR REPLACE FUNCTION public.record_usage(_metric text, _quantity numeric DEFAULT 1, _outlet_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid := public.current_company_id();
  v_month date := date_trunc('month', now())::date;
  v_day date := current_date;
BEGIN
  IF v_company IS NULL THEN RETURN; END IF;
  IF _metric NOT IN ('copilot_queries','audio_minutes','storage_gb','egress_gb','ai_tokens') THEN
    RAISE EXCEPTION 'Unknown usage metric: %', _metric;
  END IF;

  INSERT INTO public.usage_counters (company_id, outlet_id, period_month)
  VALUES (v_company, _outlet_id, v_month)
  ON CONFLICT (company_id, period_month, coalesce(outlet_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO NOTHING;

  EXECUTE format(
    'UPDATE public.usage_counters SET %I = %I + $1 WHERE company_id = $2 AND period_month = $3
       AND coalesce(outlet_id, ''00000000-0000-0000-0000-000000000000''::uuid) = coalesce($4, ''00000000-0000-0000-0000-000000000000''::uuid)',
    _metric, _metric)
  USING _quantity, v_company, v_month, _outlet_id;

  INSERT INTO public.usage_daily_counters (company_id, outlet_id, usage_date)
  VALUES (v_company, _outlet_id, v_day)
  ON CONFLICT (company_id, usage_date, coalesce(outlet_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO NOTHING;

  EXECUTE format(
    'UPDATE public.usage_daily_counters SET %I = %I + $1 WHERE company_id = $2 AND usage_date = $3
       AND coalesce(outlet_id, ''00000000-0000-0000-0000-000000000000''::uuid) = coalesce($4, ''00000000-0000-0000-0000-000000000000''::uuid)',
    _metric, _metric)
  USING _quantity, v_company, v_day, _outlet_id;
END;
$function$;

-- 6. Flat rows for CSV export ---------------------------------------------
CREATE OR REPLACE FUNCTION public.usage_export_rows(_month date DEFAULT NULL::date)
RETURNS TABLE(
  scope text, outlet_name text, outlet_code text, region text,
  period_month date, copilot_queries numeric, query_limit numeric,
  audio_minutes numeric, audio_minutes_limit numeric,
  storage_gb numeric, egress_gb numeric, ai_tokens numeric,
  queries_remaining numeric, audio_minutes_remaining numeric, throttled boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH v AS (SELECT public.current_company_id() AS company,
                    coalesce(_month, date_trunc('month', now())::date) AS m),
  cur AS (SELECT c.* FROM public.usage_counters c, v WHERE c.company_id = v.company AND c.period_month = v.m),
  plan AS (SELECT p.* FROM public.usage_plans p, v WHERE p.company_id = v.company)
  SELECT 'tenant', 'All outlets', NULL, NULL, (SELECT m FROM v),
         coalesce(sum(cur.copilot_queries),0)::numeric,
         coalesce((SELECT included_queries FROM plan),0)::numeric,
         coalesce(sum(cur.audio_minutes),0),
         coalesce((SELECT included_audio_minutes FROM plan),0)::numeric,
         coalesce(max(cur.storage_gb),0), coalesce(sum(cur.egress_gb),0),
         coalesce(sum(cur.ai_tokens),0)::numeric,
         greatest(0, coalesce((SELECT included_queries FROM plan),0) - coalesce(sum(cur.copilot_queries),0)),
         greatest(0, coalesce((SELECT included_audio_minutes FROM plan),0) - coalesce(sum(cur.audio_minutes),0)),
         coalesce((SELECT throttle_mode FROM plan),'off') <> 'off'
  FROM cur
  UNION ALL
  SELECT 'outlet', o.name, o.code, o.region, (SELECT m FROM v),
         coalesce(c.copilot_queries,0)::numeric, coalesce(q.query_limit,0)::numeric,
         coalesce(c.audio_minutes,0), coalesce(q.audio_minutes_limit,0)::numeric,
         coalesce(c.storage_gb,0), coalesce(c.egress_gb,0), coalesce(c.ai_tokens,0)::numeric,
         greatest(0, coalesce(q.query_limit,0) - coalesce(c.copilot_queries,0)),
         greatest(0, coalesce(q.audio_minutes_limit,0) - coalesce(c.audio_minutes,0)),
         coalesce(q.throttle_enabled,false)
  FROM public.outlets o
  LEFT JOIN cur c ON c.outlet_id = o.id
  LEFT JOIN public.outlet_quotas q ON q.outlet_id = o.id
  WHERE o.deleted_at IS NULL AND o.company_id = (SELECT company FROM v)
  ORDER BY 1, 2;
$function$;

REVOKE ALL ON FUNCTION public.usage_export_rows(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usage_export_rows(date) TO authenticated;

-- 7. Evaluate thresholds, throttling and anomalies -------------------------
CREATE OR REPLACE FUNCTION public.evaluate_usage_alerts()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid := public.current_company_id();
  v_month date := date_trunc('month', now())::date;
  v_created integer := 0;
  r record;
  pl public.usage_plans%ROWTYPE;
  v_used numeric;
  v_limit numeric;
  v_pct numeric;
  v_key text;
  v_sev text;
  v_msg text;
BEGIN
  IF v_company IS NULL THEN RETURN jsonb_build_object('created', 0); END IF;
  SELECT * INTO pl FROM public.usage_plans WHERE company_id = v_company;

  -- seed default rules once
  INSERT INTO public.usage_alert_rules (company_id, metric)
  SELECT v_company, m FROM unnest(ARRAY['copilot_queries','audio_minutes','storage_gb','egress_gb']) m
  ON CONFLICT (company_id, metric) DO NOTHING;

  -- (a) tenant threshold breaches
  FOR r IN SELECT * FROM public.usage_alert_rules WHERE company_id = v_company AND enabled LOOP
    SELECT CASE r.metric
             WHEN 'copilot_queries' THEN coalesce(sum(copilot_queries),0)
             WHEN 'audio_minutes' THEN coalesce(sum(audio_minutes),0)
             WHEN 'storage_gb' THEN coalesce(max(storage_gb),0)
             ELSE coalesce(sum(egress_gb),0) END
      INTO v_used
      FROM public.usage_counters WHERE company_id = v_company AND period_month = v_month;

    v_limit := CASE r.metric
      WHEN 'copilot_queries' THEN coalesce(pl.included_queries,0)
      WHEN 'audio_minutes' THEN coalesce(pl.included_audio_minutes,0)
      WHEN 'storage_gb' THEN coalesce(pl.included_storage_gb,0)
      ELSE coalesce(pl.included_egress_gb,0) END;

    IF v_limit > 0 THEN
      v_pct := round(100.0 * v_used / v_limit, 1);
      IF v_pct >= r.critical_pct THEN v_sev := 'critical';
      ELSIF v_pct >= r.warn_pct THEN v_sev := 'warning';
      ELSE v_sev := NULL; END IF;

      IF v_sev IS NOT NULL THEN
        v_key := 'threshold:' || r.metric || ':' || v_month || ':' || v_sev;
        v_msg := replace(initcap(replace(r.metric,'_',' ')), 'Gb', 'GB')
                 || ' at ' || v_pct || '% of the included allowance ('
                 || round(v_used,1) || ' of ' || round(v_limit,1) || ').';
        INSERT INTO public.usage_alert_events (
          company_id, metric, kind, severity, scope, observed, limit_value, pct, message, dedupe_key)
        VALUES (v_company, r.metric, 'threshold', v_sev, 'tenant', v_used, v_limit, v_pct, v_msg, v_key)
        ON CONFLICT (company_id, dedupe_key) DO NOTHING;
        IF FOUND THEN v_created := v_created + 1; END IF;
      END IF;
    END IF;

    -- (b) anomaly: today's daily total vs the trailing 14-day mean
    FOR r IN
      SELECT d.outlet_id, o.name AS outlet_name,
             CASE WHEN rr.metric = 'copilot_queries' THEN d.copilot_queries::numeric
                  WHEN rr.metric = 'audio_minutes' THEN d.audio_minutes
                  WHEN rr.metric = 'storage_gb' THEN d.storage_gb
                  ELSE d.egress_gb END AS today_value,
             rr.metric, rr.spike_multiplier, rr.min_baseline,
             (SELECT avg(CASE WHEN rr.metric = 'copilot_queries' THEN h.copilot_queries::numeric
                              WHEN rr.metric = 'audio_minutes' THEN h.audio_minutes
                              WHEN rr.metric = 'storage_gb' THEN h.storage_gb
                              ELSE h.egress_gb END)
                FROM public.usage_daily_counters h
               WHERE h.company_id = v_company
                 AND coalesce(h.outlet_id,'00000000-0000-0000-0000-000000000000'::uuid)
                     = coalesce(d.outlet_id,'00000000-0000-0000-0000-000000000000'::uuid)
                 AND h.usage_date BETWEEN current_date - 15 AND current_date - 1) AS baseline
      FROM public.usage_daily_counters d
      JOIN public.usage_alert_rules rr ON rr.company_id = v_company AND rr.enabled AND rr.metric = r.metric
      LEFT JOIN public.outlets o ON o.id = d.outlet_id
      WHERE d.company_id = v_company AND d.usage_date = current_date
    LOOP
      IF r.baseline IS NULL OR r.baseline < r.min_baseline THEN CONTINUE; END IF;
      IF r.today_value < r.baseline * r.spike_multiplier THEN CONTINUE; END IF;

      v_key := 'anomaly:' || r.metric || ':' || coalesce(r.outlet_id::text,'tenant') || ':' || current_date;
      v_msg := 'Sudden spike in ' || replace(r.metric,'_',' ') || ' at '
               || coalesce(r.outlet_name,'workspace level') || ' — ' || round(r.today_value,1)
               || ' today against a 14-day average of ' || round(r.baseline,1) || '.';
      INSERT INTO public.usage_alert_events (
        company_id, outlet_id, outlet_name, metric, kind, severity, scope,
        observed, baseline, message, dedupe_key)
      VALUES (v_company, r.outlet_id, r.outlet_name, r.metric, 'anomaly', 'critical',
              CASE WHEN r.outlet_id IS NULL THEN 'tenant' ELSE 'outlet' END,
              r.today_value, r.baseline, v_msg, v_key)
      ON CONFLICT (company_id, dedupe_key) DO NOTHING;
      IF FOUND THEN v_created := v_created + 1; END IF;
    END LOOP;
  END LOOP;

  -- (c) outlet quota exhaustion / throttle activation
  FOR r IN
    SELECT o.id, o.name, q.query_limit, q.audio_minutes_limit, q.throttle_enabled,
           coalesce(c.copilot_queries,0)::numeric AS queries,
           coalesce(c.audio_minutes,0) AS audio
    FROM public.outlets o
    JOIN public.outlet_quotas q ON q.outlet_id = o.id
    LEFT JOIN public.usage_counters c ON c.outlet_id = o.id AND c.period_month = v_month
    WHERE o.company_id = v_company AND o.deleted_at IS NULL AND q.throttle_enabled
  LOOP
    IF r.query_limit > 0 AND r.queries >= r.query_limit THEN
      v_key := 'throttle:copilot_queries:' || r.id || ':' || v_month;
      INSERT INTO public.usage_alert_events (
        company_id, outlet_id, outlet_name, metric, kind, severity, scope,
        observed, limit_value, pct, message, dedupe_key)
      VALUES (v_company, r.id, r.name, 'copilot_queries', 'throttle', 'critical', 'outlet',
              r.queries, r.query_limit, round(100.0 * r.queries / r.query_limit, 1),
              r.name || ' has exhausted its monthly Copilot allowance — throttling is active.', v_key)
      ON CONFLICT (company_id, dedupe_key) DO NOTHING;
      IF FOUND THEN v_created := v_created + 1; END IF;
    END IF;
    IF r.audio_minutes_limit > 0 AND r.audio >= r.audio_minutes_limit THEN
      v_key := 'throttle:audio_minutes:' || r.id || ':' || v_month;
      INSERT INTO public.usage_alert_events (
        company_id, outlet_id, outlet_name, metric, kind, severity, scope,
        observed, limit_value, pct, message, dedupe_key)
      VALUES (v_company, r.id, r.name, 'audio_minutes', 'throttle', 'critical', 'outlet',
              r.audio, r.audio_minutes_limit, round(100.0 * r.audio / r.audio_minutes_limit, 1),
              r.name || ' has exhausted its monthly audio-minute allowance — throttling is active.', v_key)
      ON CONFLICT (company_id, dedupe_key) DO NOTHING;
      IF FOUND THEN v_created := v_created + 1; END IF;
    END IF;
  END LOOP;

  -- tenant hard budget stop
  IF pl.id IS NOT NULL AND pl.hard_budget_stop THEN
    SELECT coalesce(sum(copilot_queries),0) INTO v_used
      FROM public.usage_counters WHERE company_id = v_company AND period_month = v_month;
    IF pl.included_queries > 0
       AND (v_used - pl.included_queries) * pl.overage_query_price > pl.monthly_budget THEN
      v_key := 'throttle:budget:' || v_month;
      INSERT INTO public.usage_alert_events (
        company_id, metric, kind, severity, scope, observed, limit_value, message, dedupe_key)
      VALUES (v_company, 'copilot_queries', 'throttle', 'critical', 'tenant', v_used,
              pl.included_queries,
              'Monthly budget cap reached — Copilot is blocked until the next cycle or the budget is raised.',
              v_key)
      ON CONFLICT (company_id, dedupe_key) DO NOTHING;
      IF FOUND THEN v_created := v_created + 1; END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('created', v_created, 'evaluatedAt', now());
END;
$function$;

REVOKE ALL ON FUNCTION public.evaluate_usage_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_usage_alerts() TO authenticated;

-- 8. Cross-tenant view for the super admin ---------------------------------
CREATE OR REPLACE FUNCTION public.platform_usage_overview(_month date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_month date := coalesce(_month, date_trunc('month', now())::date);
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Only platform super admins may read cross-tenant usage';
  END IF;

  WITH per_tenant AS (
    SELECT co.id, co.name,
           coalesce(sum(c.copilot_queries),0)::numeric AS queries,
           coalesce(sum(c.audio_minutes),0) AS audio_minutes,
           coalesce(max(c.storage_gb),0) AS storage_gb,
           coalesce(sum(c.egress_gb),0) AS egress_gb,
           coalesce(max(p.included_queries),0)::numeric AS included_queries,
           coalesce(max(p.included_audio_minutes),0)::numeric AS included_audio_minutes,
           coalesce(max(p.monthly_budget),0) AS monthly_budget,
           coalesce(max(p.currency),'SGD') AS currency
    FROM public.companies co
    LEFT JOIN public.usage_counters c ON c.company_id = co.id AND c.period_month = v_month
    LEFT JOIN public.usage_plans p ON p.company_id = co.id
    WHERE co.deleted_at IS NULL
    GROUP BY co.id, co.name
  )
  SELECT jsonb_build_object(
    'month', v_month,
    'tenants', coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.queries DESC), '[]'::jsonb)
  ) INTO v_result FROM per_tenant t;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_usage_overview(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_usage_overview(date) TO authenticated;

-- 9. Demo daily history so anomaly detection has a baseline ----------------
INSERT INTO public.usage_daily_counters (company_id, outlet_id, usage_date, copilot_queries, audio_minutes, storage_gb, egress_gb, ai_tokens)
SELECT o.company_id, o.id, d::date,
       (35 + (abs(hashtext(o.id::text || d::text)) % 30))::int,
       round((90 + (abs(hashtext(o.id::text || d::text || 'a')) % 70))::numeric, 1),
       round((4 + (abs(hashtext(o.id::text)) % 6))::numeric, 2),
       round((1.2 + (abs(hashtext(o.id::text || d::text || 'e')) % 4))::numeric, 2),
       (9000 + (abs(hashtext(o.id::text || d::text || 't')) % 6000))::bigint
FROM public.outlets o
CROSS JOIN generate_series(current_date - 20, current_date - 1, interval '1 day') d
WHERE o.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- today, with two deliberate spikes so the anomaly panel is meaningful
INSERT INTO public.usage_daily_counters (company_id, outlet_id, usage_date, copilot_queries, audio_minutes, storage_gb, egress_gb, ai_tokens)
SELECT o.company_id, o.id, current_date,
       CASE WHEN rn <= 2 THEN 480 ELSE (35 + (abs(hashtext(o.id::text)) % 25))::int END,
       CASE WHEN rn = 1 THEN 900 ELSE round((95 + (abs(hashtext(o.id::text || 'x')) % 60))::numeric, 1) END,
       round((4 + (abs(hashtext(o.id::text)) % 6))::numeric, 2),
       CASE WHEN rn = 2 THEN 42 ELSE round((1.4 + (abs(hashtext(o.id::text || 'y')) % 3))::numeric, 2) END,
       (11000 + (abs(hashtext(o.id::text || 'z')) % 5000))::bigint
FROM (SELECT o.*, row_number() OVER (ORDER BY o.created_at) rn FROM public.outlets o WHERE o.deleted_at IS NULL) o
ON CONFLICT DO NOTHING;
