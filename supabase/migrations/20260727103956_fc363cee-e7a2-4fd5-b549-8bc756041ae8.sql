GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_operate() TO authenticated;