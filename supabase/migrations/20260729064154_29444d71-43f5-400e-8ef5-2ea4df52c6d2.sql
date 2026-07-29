
REVOKE EXECUTE ON FUNCTION public.usage_export_rows(date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.evaluate_usage_alerts() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.platform_usage_overview(date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.usage_export_rows(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_usage_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_usage_overview(date) TO authenticated;
