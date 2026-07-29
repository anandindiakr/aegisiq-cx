
DROP FUNCTION IF EXISTS public.usage_export_rows(date);

CREATE FUNCTION public.usage_export_rows(_month date DEFAULT NULL)
RETURNS TABLE(
  scope text, outlet_name text, outlet_code text, region text, period_month date,
  copilot_queries integer, query_limit integer, audio_minutes numeric,
  audio_minutes_limit integer, storage_gb numeric, egress_gb numeric, ai_tokens bigint,
  queries_remaining integer, audio_minutes_remaining numeric, throttled boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH v_company AS (SELECT public.current_company_id() AS id),
  m AS (SELECT coalesce(_month, date_trunc('month', now())::date) AS period),
  plan AS (SELECT * FROM public.usage_plans WHERE company_id = (SELECT id FROM v_company)),
  rows_outlet AS (
    SELECT 'outlet'::text AS scope, o.name, o.code, o.region, (SELECT period FROM m) AS period_month,
           coalesce(sum(c.copilot_queries),0)::int AS q,
           coalesce(q2.query_limit,0)::int AS q_limit,
           coalesce(sum(c.audio_minutes),0)::numeric AS a,
           coalesce(q2.audio_minutes_limit,0)::int AS a_limit,
           coalesce(sum(c.storage_gb),0)::numeric AS s,
           coalesce(sum(c.egress_gb),0)::numeric AS e,
           coalesce(sum(c.ai_tokens),0)::bigint AS t,
           coalesce(q2.throttle_enabled,false) AS throttled
    FROM public.outlets o
    LEFT JOIN public.usage_counters c
      ON c.outlet_id = o.id AND c.period_month = (SELECT period FROM m)
    LEFT JOIN public.outlet_quotas q2 ON q2.outlet_id = o.id
    WHERE o.deleted_at IS NULL AND o.company_id = (SELECT id FROM v_company)
    GROUP BY o.name, o.code, o.region, q2.query_limit, q2.audio_minutes_limit, q2.throttle_enabled
  ),
  row_tenant AS (
    SELECT 'tenant'::text AS scope, NULL::text AS name, NULL::text AS code, NULL::text AS region,
           (SELECT period FROM m) AS period_month,
           coalesce(sum(c.copilot_queries),0)::int AS q,
           coalesce((SELECT included_queries FROM plan),0)::int AS q_limit,
           coalesce(sum(c.audio_minutes),0)::numeric AS a,
           coalesce((SELECT included_audio_minutes FROM plan),0)::int AS a_limit,
           coalesce(sum(c.storage_gb),0)::numeric AS s,
           coalesce(sum(c.egress_gb),0)::numeric AS e,
           coalesce(sum(c.ai_tokens),0)::bigint AS t,
           coalesce((SELECT throttle_mode FROM plan),'off') <> 'off' AS throttled
    FROM public.usage_counters c
    WHERE c.company_id = (SELECT id FROM v_company) AND c.period_month = (SELECT period FROM m)
  )
  SELECT scope, name, code, region, period_month, q, q_limit, round(a,2), a_limit,
         round(s,3), round(e,3), t,
         GREATEST(0, q_limit - q), GREATEST(0, a_limit - a), throttled
  FROM (SELECT * FROM row_tenant UNION ALL SELECT * FROM rows_outlet) x
  ORDER BY scope DESC, name NULLS FIRST;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_usage_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_month date := date_trunc('month', now())::date;
  v_today date := now()::date;
  r record;
  o record;
  p public.usage_plans%ROWTYPE;
  v_used numeric;
  v_limit numeric;
  v_pct numeric;
  v_today_val numeric;
  v_baseline numeric;
  v_key text;
  v_created int := 0;
BEGIN
  IF v_company IS NULL THEN RETURN jsonb_build_object('created', 0); END IF;
  SELECT * INTO p FROM public.usage_plans WHERE company_id = v_company;

  FOR r IN SELECT * FROM public.usage_alert_rules WHERE company_id = v_company AND enabled LOOP
    EXECUTE format(
      'SELECT coalesce(sum(%I),0) FROM public.usage_counters WHERE company_id = $1 AND period_month = $2',
      r.metric)
      INTO v_used USING v_company, v_month;

    v_limit := CASE r.metric
      WHEN 'copilot_queries' THEN coalesce(p.included_queries, 0)
      WHEN 'audio_minutes' THEN coalesce(p.included_audio_minutes, 0)
      WHEN 'storage_gb' THEN coalesce(p.included_storage_gb, 0)
      ELSE coalesce(p.included_egress_gb, 0) END;

    IF v_limit > 0 THEN
      v_pct := round(100.0 * v_used / v_limit, 1);

      IF v_pct >= r.critical_pct THEN
        v_key := 'throttle:' || r.metric || ':' || v_today;
        IF NOT EXISTS (SELECT 1 FROM public.usage_alert_events
                       WHERE company_id = v_company AND dedupe_key = v_key) THEN
          INSERT INTO public.usage_alert_events (
            company_id, metric, kind, severity, scope, observed, limit_value, pct, message, dedupe_key)
          VALUES (v_company, r.metric, 'throttle', 'critical', 'tenant', v_used, v_limit, v_pct,
            format('%s has reached %s%% of the workspace allowance (%s of %s) — %s throttling is in effect.',
                   r.metric, v_pct, round(v_used,1), v_limit, coalesce(p.throttle_mode,'off')),
            v_key);
          v_created := v_created + 1;
        END IF;
      ELSIF v_pct >= r.warn_pct THEN
        v_key := 'threshold:' || r.metric || ':' || v_today;
        IF NOT EXISTS (SELECT 1 FROM public.usage_alert_events
                       WHERE company_id = v_company AND dedupe_key = v_key) THEN
          INSERT INTO public.usage_alert_events (
            company_id, metric, kind, severity, scope, observed, limit_value, pct, message, dedupe_key)
          VALUES (v_company, r.metric, 'threshold', 'warning', 'tenant', v_used, v_limit, v_pct,
            format('%s is at %s%% of the workspace allowance (%s of %s).',
                   r.metric, v_pct, round(v_used,1), v_limit),
            v_key);
          v_created := v_created + 1;
        END IF;
      END IF;
    END IF;

    EXECUTE format(
      'SELECT coalesce(sum(%I),0) FROM public.usage_daily_counters WHERE company_id = $1 AND usage_date = $2',
      r.metric) INTO v_today_val USING v_company, v_today;
    EXECUTE format(
      'SELECT coalesce(avg(d),0) FROM (SELECT usage_date, sum(%I) AS d FROM public.usage_daily_counters
         WHERE company_id = $1 AND usage_date >= $2 - 14 AND usage_date < $2 GROUP BY usage_date) s',
      r.metric) INTO v_baseline USING v_company, v_today;

    IF v_baseline >= r.min_baseline AND v_today_val > v_baseline * r.spike_multiplier THEN
      v_key := 'anomaly:' || r.metric || ':' || v_today;
      IF NOT EXISTS (SELECT 1 FROM public.usage_alert_events
                     WHERE company_id = v_company AND dedupe_key = v_key) THEN
        INSERT INTO public.usage_alert_events (
          company_id, metric, kind, severity, scope, observed, baseline, pct, message, dedupe_key)
        VALUES (v_company, r.metric, 'anomaly', 'critical', 'tenant', v_today_val, v_baseline,
          round(100.0 * v_today_val / NULLIF(v_baseline,0), 1),
          format('%s spiked to %s today against a 14-day average of %s (%sx).',
                 r.metric, round(v_today_val,1), round(v_baseline,1),
                 round(v_today_val / NULLIF(v_baseline,0), 1)),
          v_key);
        v_created := v_created + 1;
      END IF;
    END IF;

    IF r.metric IN ('copilot_queries','audio_minutes') THEN
      FOR o IN
        SELECT out.id, out.name,
               CASE WHEN r.metric = 'copilot_queries'
                    THEN coalesce(q.query_limit,0)::numeric
                    ELSE coalesce(q.audio_minutes_limit,0)::numeric END AS lim,
               CASE WHEN r.metric = 'copilot_queries'
                    THEN coalesce(sum(c.copilot_queries),0)::numeric
                    ELSE coalesce(sum(c.audio_minutes),0)::numeric END AS used
        FROM public.outlets out
        JOIN public.outlet_quotas q ON q.outlet_id = out.id AND q.throttle_enabled
        LEFT JOIN public.usage_counters c ON c.outlet_id = out.id AND c.period_month = v_month
        WHERE out.company_id = v_company AND out.deleted_at IS NULL
        GROUP BY out.id, out.name, q.query_limit, q.audio_minutes_limit
      LOOP
        CONTINUE WHEN o.lim <= 0;
        v_pct := round(100.0 * o.used / o.lim, 1);
        CONTINUE WHEN v_pct < r.warn_pct;
        v_key := 'outlet:' || o.id || ':' || r.metric || ':' || v_today;
        CONTINUE WHEN EXISTS (SELECT 1 FROM public.usage_alert_events
                              WHERE company_id = v_company AND dedupe_key = v_key);
        INSERT INTO public.usage_alert_events (
          company_id, outlet_id, outlet_name, metric, kind, severity, scope,
          observed, limit_value, pct, message, dedupe_key)
        VALUES (v_company, o.id, o.name, r.metric,
          CASE WHEN v_pct >= r.critical_pct THEN 'throttle' ELSE 'threshold' END,
          CASE WHEN v_pct >= r.critical_pct THEN 'critical' ELSE 'warning' END,
          'outlet', o.used, o.lim, v_pct,
          format('%s at %s is at %s%% of its outlet quota (%s of %s).',
                 r.metric, o.name, v_pct, round(o.used,1), o.lim),
          v_key);
        v_created := v_created + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('created', v_created);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_usage_overview(_month date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_month date := coalesce(_month, date_trunc('month', now())::date);
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only platform super admins may read cross-tenant usage';
  END IF;

  RETURN jsonb_build_object(
    'month', v_month,
    'tenants', coalesce((
      SELECT jsonb_agg(t ORDER BY t.queries DESC) FROM (
        SELECT c.id, c.name,
               coalesce(sum(u.copilot_queries),0)::int AS queries,
               round(coalesce(sum(u.audio_minutes),0),1) AS audio_minutes,
               round(coalesce(sum(u.storage_gb),0),2) AS storage_gb,
               round(coalesce(sum(u.egress_gb),0),2) AS egress_gb,
               coalesce(max(p.included_queries),0) AS included_queries,
               coalesce(max(p.included_audio_minutes),0) AS included_audio_minutes,
               coalesce(max(p.monthly_budget),0) AS monthly_budget,
               coalesce(max(p.currency),'SGD') AS currency
        FROM public.companies c
        LEFT JOIN public.usage_counters u ON u.company_id = c.id AND u.period_month = v_month
        LEFT JOIN public.usage_plans p ON p.company_id = c.id
        WHERE c.deleted_at IS NULL
        GROUP BY c.id, c.name
      ) t), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.usage_export_rows(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_usage_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_usage_overview(date) TO authenticated;
