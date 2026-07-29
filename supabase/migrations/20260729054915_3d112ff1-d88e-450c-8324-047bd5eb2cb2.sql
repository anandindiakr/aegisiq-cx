
-- 1. Plans -------------------------------------------------------------
CREATE TABLE public.usage_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_name text NOT NULL DEFAULT 'Professional',
  currency text NOT NULL DEFAULT 'SGD',
  monthly_budget numeric NOT NULL DEFAULT 5000,
  included_queries integer NOT NULL DEFAULT 20000,
  included_audio_minutes integer NOT NULL DEFAULT 60000,
  included_storage_gb numeric NOT NULL DEFAULT 500,
  included_egress_gb numeric NOT NULL DEFAULT 250,
  overage_query_price numeric NOT NULL DEFAULT 0.45,
  overage_audio_minute_price numeric NOT NULL DEFAULT 0.08,
  overage_storage_gb_price numeric NOT NULL DEFAULT 0.35,
  overage_egress_gb_price numeric NOT NULL DEFAULT 0.20,
  throttle_mode text NOT NULL DEFAULT 'warn',
  throttle_threshold_pct integer NOT NULL DEFAULT 90,
  hard_budget_stop boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_plans TO authenticated;
GRANT ALL ON public.usage_plans TO service_role;
ALTER TABLE public.usage_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_plans_read" ON public.usage_plans FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "usage_plans_write" ON public.usage_plans FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER usage_plans_updated_at BEFORE UPDATE ON public.usage_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Per-outlet quotas --------------------------------------------------
CREATE TABLE public.outlet_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  query_limit integer NOT NULL DEFAULT 1500,
  audio_minutes_limit integer NOT NULL DEFAULT 5000,
  throttle_enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outlet_quotas TO authenticated;
GRANT ALL ON public.outlet_quotas TO service_role;
ALTER TABLE public.outlet_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outlet_quotas_read" ON public.outlet_quotas FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "outlet_quotas_write" ON public.outlet_quotas FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER outlet_quotas_updated_at BEFORE UPDATE ON public.outlet_quotas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Monthly counters ---------------------------------------------------
CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  copilot_queries integer NOT NULL DEFAULT 0,
  audio_minutes numeric NOT NULL DEFAULT 0,
  storage_gb numeric NOT NULL DEFAULT 0,
  egress_gb numeric NOT NULL DEFAULT 0,
  ai_tokens bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usage_counters_unique
  ON public.usage_counters (company_id, period_month, coalesce(outlet_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_counters_read" ON public.usage_counters FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "usage_counters_write" ON public.usage_counters FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_company_admin());
CREATE TRIGGER usage_counters_updated_at BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Pricing configurator scenarios (super admin) ------------------------
CREATE TABLE public.pricing_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'SGD',
  outlets integer NOT NULL DEFAULT 10,
  cameras_per_outlet integer NOT NULL DEFAULT 6,
  included_query_packs integer NOT NULL DEFAULT 4,
  queries_per_pack integer NOT NULL DEFAULT 1000,
  audio_hours_per_outlet integer NOT NULL DEFAULT 300,
  platform_fee numeric NOT NULL DEFAULT 2000,
  price_per_outlet numeric NOT NULL DEFAULT 699,
  price_per_camera numeric NOT NULL DEFAULT 45,
  price_per_query_pack numeric NOT NULL DEFAULT 320,
  price_per_audio_hour numeric NOT NULL DEFAULT 1.2,
  cost_per_outlet numeric NOT NULL DEFAULT 120,
  cost_per_query numeric NOT NULL DEFAULT 0.08,
  cost_per_audio_hour numeric NOT NULL DEFAULT 0.35,
  target_margin_pct integer NOT NULL DEFAULT 200,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_scenarios TO authenticated;
GRANT ALL ON public.pricing_scenarios TO service_role;
ALTER TABLE public.pricing_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_scenarios_read" ON public.pricing_scenarios FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "pricing_scenarios_write" ON public.pricing_scenarios FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER pricing_scenarios_updated_at BEFORE UPDATE ON public.pricing_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Usage recording + quota gate ---------------------------------------
CREATE OR REPLACE FUNCTION public.record_usage(
  _metric text,
  _quantity numeric DEFAULT 1,
  _outlet_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_month date := date_trunc('month', now())::date;
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
END;
$$;

CREATE OR REPLACE FUNCTION public.check_copilot_quota(_outlet_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_month date := date_trunc('month', now())::date;
  p public.usage_plans%ROWTYPE;
  q public.outlet_quotas%ROWTYPE;
  v_tenant_used integer := 0;
  v_outlet_used integer := 0;
  v_pct numeric := 0;
BEGIN
  IF v_company IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_workspace');
  END IF;

  SELECT * INTO p FROM public.usage_plans WHERE company_id = v_company;
  IF p.id IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_plan');
  END IF;

  SELECT coalesce(sum(copilot_queries),0) INTO v_tenant_used
  FROM public.usage_counters WHERE company_id = v_company AND period_month = v_month;

  IF _outlet_id IS NOT NULL THEN
    SELECT * INTO q FROM public.outlet_quotas WHERE outlet_id = _outlet_id;
    SELECT coalesce(sum(copilot_queries),0) INTO v_outlet_used
    FROM public.usage_counters
    WHERE company_id = v_company AND period_month = v_month AND outlet_id = _outlet_id;
  END IF;

  IF p.included_queries > 0 THEN
    v_pct := round(100.0 * v_tenant_used / p.included_queries, 1);
  END IF;

  IF q.id IS NOT NULL AND q.throttle_enabled AND q.query_limit > 0 AND v_outlet_used >= q.query_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'outlet_quota_exceeded',
      'scope', 'outlet', 'used', v_outlet_used, 'limit', q.query_limit, 'tenantPct', v_pct);
  END IF;

  IF p.throttle_mode = 'block' AND v_tenant_used >= p.included_queries THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'tenant_quota_exceeded',
      'scope', 'tenant', 'used', v_tenant_used, 'limit', p.included_queries, 'tenantPct', v_pct);
  END IF;

  IF p.hard_budget_stop AND p.included_queries > 0
     AND (v_tenant_used - p.included_queries) * p.overage_query_price > p.monthly_budget THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'budget_exceeded',
      'scope', 'tenant', 'used', v_tenant_used, 'limit', p.included_queries, 'tenantPct', v_pct);
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'warn', v_pct >= p.throttle_threshold_pct,
    'tenantPct', v_pct,
    'used', v_tenant_used,
    'limit', p.included_queries,
    'outletUsed', v_outlet_used,
    'outletLimit', coalesce(q.query_limit, 0)
  );
END;
$$;

-- 6. Metered usage overview ---------------------------------------------
CREATE OR REPLACE FUNCTION public.usage_overview(_month date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid := public.current_company_id();
  v_month date := coalesce(_month, date_trunc('month', now())::date);
  v_result jsonb;
BEGIN
  IF v_company IS NULL THEN RETURN '{}'::jsonb; END IF;

  WITH plan AS (
    SELECT * FROM public.usage_plans WHERE company_id = v_company
  ),
  cur AS (
    SELECT * FROM public.usage_counters WHERE company_id = v_company AND period_month = v_month
  ),
  totals AS (
    SELECT coalesce(sum(copilot_queries),0)::numeric AS queries,
           coalesce(sum(audio_minutes),0) AS audio_minutes,
           coalesce(max(storage_gb),0) AS storage_gb,
           coalesce(sum(egress_gb),0) AS egress_gb,
           coalesce(sum(ai_tokens),0)::numeric AS ai_tokens
    FROM cur
  ),
  per_outlet AS (
    SELECT o.id, o.name, o.code, o.region,
           coalesce(c.copilot_queries,0) AS queries,
           coalesce(c.audio_minutes,0) AS audio_minutes,
           coalesce(c.storage_gb,0) AS storage_gb,
           coalesce(c.egress_gb,0) AS egress_gb,
           coalesce(q.query_limit,0) AS query_limit,
           coalesce(q.audio_minutes_limit,0) AS audio_minutes_limit,
           coalesce(q.throttle_enabled,false) AS throttle_enabled
    FROM public.outlets o
    LEFT JOIN cur c ON c.outlet_id = o.id
    LEFT JOIN public.outlet_quotas q ON q.outlet_id = o.id
    WHERE o.deleted_at IS NULL AND o.company_id = v_company
  ),
  trend AS (
    SELECT period_month,
           sum(copilot_queries) AS queries,
           sum(audio_minutes) AS audio_minutes,
           sum(egress_gb) AS egress_gb
    FROM public.usage_counters
    WHERE company_id = v_company AND period_month >= (v_month - interval '5 months')::date
    GROUP BY period_month ORDER BY period_month
  )
  SELECT jsonb_build_object(
    'month', v_month,
    'plan', (SELECT to_jsonb(p) FROM plan p),
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'outlets', (SELECT coalesce(jsonb_agg(to_jsonb(po) ORDER BY po.queries DESC), '[]'::jsonb) FROM per_outlet po),
    'trend', (SELECT coalesce(jsonb_agg(to_jsonb(tr) ORDER BY tr.period_month), '[]'::jsonb) FROM trend tr)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 7. Platform super admin -------------------------------------------------
DO $$
DECLARE
  v_user uuid;
  v_company uuid;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = 'anandindiakr@gmail.com' LIMIT 1;
  SELECT id INTO v_company FROM public.companies ORDER BY created_at LIMIT 1;
  IF v_user IS NOT NULL AND v_company IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES (v_user, v_company, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- 8. Seed plan, quotas and demo usage -------------------------------------
INSERT INTO public.usage_plans (company_id)
SELECT id FROM public.companies ORDER BY created_at LIMIT 1
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO public.outlet_quotas (company_id, outlet_id)
SELECT o.company_id, o.id FROM public.outlets o WHERE o.deleted_at IS NULL
ON CONFLICT (outlet_id) DO NOTHING;

INSERT INTO public.usage_counters (company_id, outlet_id, period_month, copilot_queries, audio_minutes, storage_gb, egress_gb, ai_tokens)
SELECT o.company_id, o.id, (date_trunc('month', now()) - (m || ' months')::interval)::date,
       (250 + random()*1400)::int,
       round((900 + random()*4200)::numeric, 1),
       round((8 + random()*60)::numeric, 2),
       round((3 + random()*40)::numeric, 2),
       (180000 + random()*900000)::bigint
FROM public.outlets o CROSS JOIN generate_series(0, 3) AS m
WHERE o.deleted_at IS NULL
ON CONFLICT DO NOTHING;
