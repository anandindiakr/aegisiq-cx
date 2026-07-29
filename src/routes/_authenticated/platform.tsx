import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Gauge, LayoutGrid, ServerCog, Wallet } from "lucide-react";

import { PageHeader } from "@/components/common/Primitives";
import { cn } from "@/lib/utils";
import { requireRoles } from "@/features/platform/tenant";

export const Route = createFileRoute("/_authenticated/platform")({
  // Platform Console: the AI Algo super-admin surface, above tenant admins.
  beforeLoad: ({ context }) => requireRoles(context.tenant, ["super_admin"]),
  head: () => ({
    meta: [
      { title: "Platform Console — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Super admin control plane for AegisIQ CX: tenants, users and roles, edge compute fleet, connections, metered usage and tenant pricing.",
      },
      { property: "og:title", content: "Platform Console — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Operate the entire AegisIQ CX platform from one control plane.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlatformLayout,
});

export const PLATFORM_SECTIONS = [
  { title: "Control Centre", url: "/platform", icon: LayoutGrid, exact: true },
  { title: "Metered Usage", url: "/platform/usage", icon: Gauge },
  { title: "Pricing Configurator", url: "/platform/pricing", icon: Wallet },
  { title: "Edge & Connections", url: "/platform/edge", icon: ServerCog },
] as const;

function PlatformLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div>
      <PageHeader
        title="Platform Console"
        description="Super-admin control plane — tenant governance, identity, edge compute, connections, metering and commercial modelling."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Platform sections"
          className="panel flex gap-1 overflow-x-auto p-2 lg:sticky lg:top-4 lg:h-fit lg:flex-col lg:overflow-visible"
        >
          {PLATFORM_SECTIONS.map((item) => {
            const active = "exact" in item ? pathname === item.url : pathname.startsWith(item.url);
            return (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/12 text-primary ring-1 ring-primary/25"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
