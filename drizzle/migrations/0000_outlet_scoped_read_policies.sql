-- Outlet-scoped read access: head-office roles (super_admin, tenant_admin,
-- regional_manager) see the whole tenant; outlet_manager, supervisor and viewer
-- only see rows for the outlet on their profile (or everything if unassigned).
CREATE OR REPLACE FUNCTION public.can_view_outlet(_outlet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(),'super_admin')
      OR public.has_role(auth.uid(),'tenant_admin')
      OR public.has_role(auth.uid(),'regional_manager')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND (p.outlet_id IS NULL OR p.outlet_id = _outlet_id)
      );
$$;

DROP POLICY IF EXISTS outlets_tenant_read ON public.outlets;
CREATE POLICY outlets_tenant_read ON public.outlets
  FOR SELECT TO authenticated
  USING ((company_id = public.current_company_id() AND public.can_view_outlet(id))
      OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS conversations_tenant_read ON public.conversations;
CREATE POLICY conversations_tenant_read ON public.conversations
  FOR SELECT TO authenticated
  USING ((company_id = public.current_company_id() AND public.can_view_outlet(outlet_id))
      OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS alerts_tenant_read ON public.alerts;
CREATE POLICY alerts_tenant_read ON public.alerts
  FOR SELECT TO authenticated
  USING ((company_id = public.current_company_id() AND public.can_view_outlet(outlet_id))
      OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS cameras_tenant_read ON public.cameras;
CREATE POLICY cameras_tenant_read ON public.cameras
  FOR SELECT TO authenticated
  USING ((company_id = public.current_company_id() AND public.can_view_outlet(outlet_id))
      OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS transcripts_tenant_read ON public.transcripts;
CREATE POLICY transcripts_tenant_read ON public.transcripts
  FOR SELECT TO authenticated
  USING ((company_id = public.current_company_id() AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id AND public.can_view_outlet(c.outlet_id)
      )) OR public.has_role(auth.uid(),'super_admin'));
