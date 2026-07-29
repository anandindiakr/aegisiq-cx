
REVOKE EXECUTE ON FUNCTION public.record_usage(text, numeric, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_copilot_quota(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.usage_overview(date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_usage(text, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_copilot_quota(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usage_overview(date) TO authenticated;
