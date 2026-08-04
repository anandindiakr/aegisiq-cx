DROP POLICY IF EXISTS engines_select ON public.ai_engines;
CREATE POLICY engines_select ON public.ai_engines FOR SELECT TO authenticated
USING (company_id = current_company_id() AND (can_operate() OR is_company_admin()));

DROP POLICY IF EXISTS integrations_select ON public.integration_connections;
CREATE POLICY integrations_select ON public.integration_connections FOR SELECT TO authenticated
USING (company_id = current_company_id() AND is_company_admin());

DROP POLICY IF EXISTS notification_rules_read ON public.notification_rules;
CREATE POLICY notification_rules_read ON public.notification_rules FOR SELECT TO authenticated
USING (company_id = current_company_id() AND (can_operate() OR is_company_admin()));