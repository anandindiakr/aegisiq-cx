
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.current_company_id() from public, anon, authenticated;
revoke all on function public.is_company_admin() from public, anon, authenticated;
revoke all on function public.can_operate() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
