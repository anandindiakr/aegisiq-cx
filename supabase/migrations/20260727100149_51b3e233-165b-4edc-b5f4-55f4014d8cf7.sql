ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS brand_primary_color text NOT NULL DEFAULT '#4f8cff',
  ADD COLUMN IF NOT EXISTS brand_tagline text;

ALTER TABLE public.alerts REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'alerts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tenant_branding()
RETURNS TABLE (name text, logo_url text, brand_primary_color text, brand_tagline text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.name, c.logo_url, c.brand_primary_color, c.brand_tagline
  FROM public.companies c
  WHERE c.deleted_at IS NULL AND c.status = 'active'
  ORDER BY c.created_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.tenant_branding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_branding() TO anon, authenticated;