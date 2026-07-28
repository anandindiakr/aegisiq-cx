REVOKE EXECUTE ON FUNCTION public.expire_widget_access_requests() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.preset_by_share_token(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.expire_widget_access_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.preset_by_share_token(text) TO authenticated;