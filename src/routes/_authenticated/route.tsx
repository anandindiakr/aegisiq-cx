import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { loadTenantContext } from "@/features/platform/tenant";
import { setActiveTenant } from "@/features/platform/queries";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/signin" });

    // Tenant guard: resolve the caller's company once and scope the whole
    // subtree to it. RLS remains the enforcement point in the database.
    const tenant = await loadTenantContext();
    setActiveTenant(tenant.companyId);

    return { user: data.user, tenant };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
