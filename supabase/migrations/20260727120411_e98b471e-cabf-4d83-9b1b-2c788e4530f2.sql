
CREATE OR REPLACE FUNCTION public.executive_overview(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_from timestamptz := coalesce((p_filters->>'from')::timestamptz, date_trunc('day', now()));
  v_to   timestamptz := coalesce((p_filters->>'to')::timestamptz, now());
  v_hf   int := coalesce((p_filters->>'hourFrom')::int, 0);
  v_ht   int := coalesce((p_filters->>'hourTo')::int, 23);
  v_span interval;
  v_result jsonb;
BEGIN
  IF v_to <= v_from THEN v_to := v_from + interval '1 day'; END IF;
  v_span := v_to - v_from;

  WITH base AS (
    SELECT c.*, o.name AS outlet_name, o.code AS outlet_code, o.region, o.city,
           o.latitude, o.longitude
    FROM public.conversations c
    JOIN public.outlets o ON o.id = c.outlet_id
    WHERE c.deleted_at IS NULL AND o.deleted_at IS NULL
      AND c.started_at >= now() - interval '35 days'
      AND (jsonb_array_length(coalesce(p_filters->'regions','[]'::jsonb)) = 0 OR (p_filters->'regions') ? o.region)
      AND (jsonb_array_length(coalesce(p_filters->'outlets','[]'::jsonb)) = 0 OR (p_filters->'outlets') ? o.id::text)
      AND (jsonb_array_length(coalesce(p_filters->'languages','[]'::jsonb)) = 0 OR (p_filters->'languages') ? c.language_code)
      AND (jsonb_array_length(coalesce(p_filters->'topics','[]'::jsonb)) = 0 OR (p_filters->'topics') ? c.topic)
      AND (jsonb_array_length(coalesce(p_filters->'risks','[]'::jsonb)) = 0 OR (p_filters->'risks') ? c.risk_level::text)
      AND (jsonb_array_length(coalesce(p_filters->'employees','[]'::jsonb)) = 0 OR (p_filters->'employees') ? c.agent_name)
      AND (jsonb_array_length(coalesce(p_filters->'keywords','[]'::jsonb)) = 0 OR EXISTS (
            SELECT 1 FROM public.conversation_keywords ck
            WHERE ck.conversation_id = c.id AND (p_filters->'keywords') ? ck.keyword))
      AND (jsonb_array_length(coalesce(p_filters->'alertTypes','[]'::jsonb)) = 0 OR EXISTS (
            SELECT 1 FROM public.alerts a
            WHERE a.conversation_id = c.id AND a.deleted_at IS NULL AND (p_filters->'alertTypes') ? a.category))
  ),
  win AS (
    SELECT * FROM base
    WHERE started_at >= v_from AND started_at < v_to
      AND extract(hour FROM started_at)::int BETWEEN v_hf AND v_ht
  ),
  prev AS (
    SELECT * FROM base
    WHERE started_at >= v_from - v_span AND started_at < v_from
      AND extract(hour FROM started_at)::int BETWEEN v_hf AND v_ht
  ),
  win_alerts AS (
    SELECT a.*, o.name AS outlet_name
    FROM public.alerts a
    LEFT JOIN public.outlets o ON o.id = a.outlet_id
    WHERE a.deleted_at IS NULL
      AND a.triggered_at >= v_from AND a.triggered_at < v_to
      AND (jsonb_array_length(coalesce(p_filters->'alertTypes','[]'::jsonb)) = 0 OR (p_filters->'alertTypes') ? a.category)
      AND (a.conversation_id IS NULL OR a.conversation_id IN (SELECT id FROM win))
  ),
  kpi AS (
    SELECT
      (SELECT count(*) FROM win) AS total,
      (SELECT count(*) FROM prev) AS total_prev,
      (SELECT count(*) FROM win WHERE sentiment IN ('positive','very_positive')) AS positive,
      (SELECT count(*) FROM prev WHERE sentiment IN ('positive','very_positive')) AS positive_prev,
      (SELECT count(*) FROM win WHERE sentiment IN ('negative','very_negative')) AS negative,
      (SELECT count(*) FROM prev WHERE sentiment IN ('negative','very_negative')) AS negative_prev,
      (SELECT coalesce(avg(sentiment_score),0) FROM win) AS avg_sentiment,
      (SELECT coalesce(avg(sentiment_score),0) FROM prev) AS avg_sentiment_prev,
      (SELECT coalesce(avg(duration_seconds),0) FROM win) AS avg_duration,
      (SELECT coalesce(avg(duration_seconds),0) FROM prev) AS avg_duration_prev,
      (SELECT count(*) FROM win WHERE topic IN ('Poor Service','Long Waiting Time','Promotion Confusion','Pricing')) AS complaints,
      (SELECT count(*) FROM prev WHERE topic IN ('Poor Service','Long Waiting Time','Promotion Confusion','Pricing')) AS complaints_prev,
      (SELECT count(*) FROM win WHERE topic IN ('Refund','Refund request')) AS refunds,
      (SELECT count(*) FROM prev WHERE topic IN ('Refund','Refund request')) AS refunds_prev,
      (SELECT count(*) FROM win WHERE topic IN ('Warranty','Warranty claim')) AS warranty,
      (SELECT count(*) FROM prev WHERE topic IN ('Warranty','Warranty claim')) AS warranty_prev,
      (SELECT count(*) FROM win WHERE escalated) AS escalations,
      (SELECT count(*) FROM prev WHERE escalated) AS escalations_prev,
      (SELECT count(*) FROM win_alerts) AS alerts,
      (SELECT count(*) FROM public.outlets WHERE deleted_at IS NULL AND status = 'active') AS active_outlets,
      (SELECT count(*) FROM public.outlets WHERE deleted_at IS NULL) AS total_outlets,
      (SELECT count(*) FROM public.cameras WHERE deleted_at IS NULL AND status = 'online') AS online_cameras,
      (SELECT count(*) FROM public.cameras WHERE deleted_at IS NULL) AS total_cameras
  ),
  outlet_perf AS (
    SELECT o.id, o.name, o.code, o.region, o.city, o.latitude, o.longitude,
           count(w.id) AS conversations,
           coalesce(avg(w.sentiment_score),0) AS avg_sentiment,
           coalesce(avg(w.duration_seconds),0) AS avg_duration,
           count(*) FILTER (WHERE w.sentiment IN ('negative','very_negative')) AS negatives,
           count(*) FILTER (WHERE w.sentiment IN ('positive','very_positive')) AS positives,
           count(*) FILTER (WHERE w.escalated) AS escalations
    FROM public.outlets o
    LEFT JOIN win w ON w.outlet_id = o.id
    WHERE o.deleted_at IS NULL
    GROUP BY o.id, o.name, o.code, o.region, o.city, o.latitude, o.longitude
  ),
  outlet_scored AS (
    SELECT *,
      CASE WHEN conversations = 0 THEN 0 ELSE round(100.0 * negatives / conversations, 1) END AS complaint_rate,
      CASE WHEN conversations = 0 THEN 0 ELSE round(100.0 * positives / conversations, 1) END AS positive_rate,
      CASE WHEN conversations = 0 THEN 0
           ELSE LEAST(100, round(100.0 * negatives / conversations + 60.0 * escalations / conversations, 1)) END AS risk_score,
      GREATEST(0, LEAST(100, round(50 + 50 * avg_sentiment
        - CASE WHEN conversations = 0 THEN 0 ELSE 40.0 * escalations / conversations END, 1))) AS overall_score
    FROM outlet_perf
  ),
  lang AS (
    SELECT w.language_code AS code,
           coalesce(l.name, upper(w.language_code)) AS name,
           count(*) AS conversations,
           coalesce(avg(w.sentiment_score),0) AS avg_sentiment,
           (SELECT count(*) FROM prev p WHERE p.language_code = w.language_code) AS prev_count
    FROM win w LEFT JOIN public.languages l ON l.code = w.language_code
    GROUP BY w.language_code, l.name
  ),
  kw AS (
    SELECT ck.keyword AS term, count(*) AS mentions,
           coalesce(avg(w.sentiment_score),0) AS avg_sentiment
    FROM public.conversation_keywords ck
    JOIN win w ON w.id = ck.conversation_id
    GROUP BY ck.keyword
  ),
  issues AS (
    SELECT w.topic AS label, count(*) AS occurrences,
           coalesce(avg(w.sentiment_score),0) AS avg_sentiment,
           (SELECT count(*) FROM prev p WHERE p.topic = w.topic) AS prev_count
    FROM win w WHERE w.topic IS NOT NULL GROUP BY w.topic
  ),
  region_perf AS (
    SELECT o.region,
           count(w.id) AS conversations,
           count(*) FILTER (WHERE w.sentiment IN ('positive','very_positive')) AS positives,
           count(*) FILTER (WHERE w.sentiment IN ('negative','very_negative')) AS negatives,
           coalesce(avg(w.duration_seconds),0) AS avg_duration,
           coalesce(avg(w.sentiment_score),0) AS avg_sentiment,
           count(*) FILTER (WHERE w.escalated) AS escalations
    FROM public.outlets o LEFT JOIN win w ON w.outlet_id = o.id
    WHERE o.deleted_at IS NULL AND o.region IS NOT NULL
    GROUP BY o.region
  ),
  daily AS (
    SELECT started_at::date AS day, count(*) AS conversations,
           coalesce(avg(sentiment_score),0) AS avg_sentiment,
           count(*) FILTER (WHERE sentiment IN ('negative','very_negative')) AS negatives
    FROM base WHERE started_at >= now() - interval '30 days'
    GROUP BY 1 ORDER BY 1
  ),
  hourly AS (
    SELECT extract(hour FROM started_at)::int AS hour, count(*) AS conversations,
           coalesce(avg(sentiment_score),0) AS avg_sentiment
    FROM win GROUP BY 1 ORDER BY 1
  )
  SELECT jsonb_build_object(
    'generatedAt', now(),
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'kpis', (SELECT to_jsonb(k) FROM kpi k),
    'sentimentPeriods', (
      SELECT jsonb_agg(x ORDER BY x.ord) FROM (
        SELECT 1 AS ord, 'today' AS key, 'Today' AS label,
               count(*) FILTER (WHERE sentiment='very_positive') AS very_positive,
               count(*) FILTER (WHERE sentiment='positive') AS positive,
               count(*) FILTER (WHERE sentiment='neutral') AS neutral,
               count(*) FILTER (WHERE sentiment='negative') AS negative,
               count(*) FILTER (WHERE sentiment='very_negative') AS very_negative,
               coalesce(avg(sentiment_score),0) AS avg_sentiment, count(*) AS total
        FROM base WHERE started_at >= date_trunc('day', now())
        UNION ALL
        SELECT 2, 'yesterday', 'Yesterday',
               count(*) FILTER (WHERE sentiment='very_positive'), count(*) FILTER (WHERE sentiment='positive'),
               count(*) FILTER (WHERE sentiment='neutral'), count(*) FILTER (WHERE sentiment='negative'),
               count(*) FILTER (WHERE sentiment='very_negative'), coalesce(avg(sentiment_score),0), count(*)
        FROM base WHERE started_at >= date_trunc('day', now()) - interval '1 day' AND started_at < date_trunc('day', now())
        UNION ALL
        SELECT 3, 'week', '7 days',
               count(*) FILTER (WHERE sentiment='very_positive'), count(*) FILTER (WHERE sentiment='positive'),
               count(*) FILTER (WHERE sentiment='neutral'), count(*) FILTER (WHERE sentiment='negative'),
               count(*) FILTER (WHERE sentiment='very_negative'), coalesce(avg(sentiment_score),0), count(*)
        FROM base WHERE started_at >= now() - interval '7 days'
        UNION ALL
        SELECT 4, 'month', '30 days',
               count(*) FILTER (WHERE sentiment='very_positive'), count(*) FILTER (WHERE sentiment='positive'),
               count(*) FILTER (WHERE sentiment='neutral'), count(*) FILTER (WHERE sentiment='negative'),
               count(*) FILTER (WHERE sentiment='very_negative'), coalesce(avg(sentiment_score),0), count(*)
        FROM base WHERE started_at >= now() - interval '30 days'
      ) x
    ),
    'outlets', (SELECT coalesce(jsonb_agg(to_jsonb(os) ORDER BY os.overall_score DESC), '[]'::jsonb) FROM outlet_scored os),
    'regions', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.avg_sentiment DESC), '[]'::jsonb) FROM region_perf r),
    'languages', (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.conversations DESC), '[]'::jsonb) FROM lang l),
    'keywords', (SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.mentions DESC), '[]'::jsonb) FROM kw k),
    'issues', (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.occurrences DESC), '[]'::jsonb) FROM issues i),
    'daily', (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.day), '[]'::jsonb) FROM daily d),
    'hourly', (SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.hour), '[]'::jsonb) FROM hourly h),
    'alertsBySeverity', (
      SELECT coalesce(jsonb_object_agg(severity, n), '{}'::jsonb)
      FROM (SELECT severity::text, count(*) n FROM win_alerts GROUP BY severity) s
    ),
    'alertsByCategory', (
      SELECT coalesce(jsonb_object_agg(category, n), '{}'::jsonb)
      FROM (SELECT coalesce(category,'other') category, count(*) n FROM win_alerts GROUP BY 1) s
    ),
    'recentAlerts', (
      SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.triggered_at DESC), '[]'::jsonb)
      FROM (SELECT id, conversation_id, outlet_id, outlet_name, title, category, severity::text, status::text, triggered_at
            FROM win_alerts ORDER BY triggered_at DESC LIMIT 12) a
    ),
    'activity', (
      SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.at DESC), '[]'::jsonb) FROM (
        SELECT * FROM (
          SELECT w.id::text AS id, 'conversation' AS kind, w.reference AS title,
                 coalesce(w.topic,'General enquiry') AS detail, w.outlet_name, w.sentiment::text AS tone, w.started_at AS at,
                 w.id::text AS conversation_id
          FROM win w ORDER BY w.started_at DESC LIMIT 25
        ) c
        UNION ALL
        SELECT * FROM (
          SELECT a.id::text, 'alert', a.title, coalesce(a.category,'alert'), a.outlet_name, a.severity::text, a.triggered_at,
                 a.conversation_id::text
          FROM win_alerts a ORDER BY a.triggered_at DESC LIMIT 25
        ) al
      ) f
    ),
    'filterOptions', jsonb_build_object(
      'regions', (SELECT coalesce(jsonb_agg(DISTINCT region), '[]'::jsonb) FROM public.outlets WHERE deleted_at IS NULL AND region IS NOT NULL),
      'outlets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'region', region) ORDER BY name), '[]'::jsonb) FROM public.outlets WHERE deleted_at IS NULL),
      'languages', (SELECT coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name) ORDER BY name), '[]'::jsonb) FROM public.languages WHERE is_active),
      'topics', (SELECT coalesce(jsonb_agg(DISTINCT topic), '[]'::jsonb) FROM base WHERE topic IS NOT NULL),
      'employees', (SELECT coalesce(jsonb_agg(DISTINCT agent_name), '[]'::jsonb) FROM base WHERE agent_name IS NOT NULL),
      'keywords', (SELECT coalesce(jsonb_agg(DISTINCT keyword), '[]'::jsonb) FROM public.conversation_keywords),
      'alertTypes', (SELECT coalesce(jsonb_agg(DISTINCT category), '[]'::jsonb) FROM public.alerts WHERE deleted_at IS NULL AND category IS NOT NULL)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.executive_overview(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.executive_overview(jsonb) TO authenticated;
