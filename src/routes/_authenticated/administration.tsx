import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BellRing,
  Building2,
  Cog,
  Cpu,
  DatabaseBackup,
  KeyRound,
  Languages,
  Plug,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Tags,
  Waves,
  Gauge,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/common/Primitives";
import { cn } from "@/lib/utils";
import { requireRoles } from "@/features/platform/tenant";

export const Route = createFileRoute("/_authenticated/administration")({
  // System-wide configuration: workspace administrators only.
  beforeLoad: ({ context }) => requireRoles(context.tenant, ["super_admin", "tenant_admin"]),
  head: () => ({
    meta: [
      { title: "Enterprise Administration — AegisIQ CX™" },
      {
        name: "description",
        content:
          "System-wide configuration for AegisIQ CX: general settings, languages, keywords, AI and speech engines, alerts, security, integrations, API keys, licensing and backup.",
      },
      { property: "og:title", content: "Enterprise Administration — AegisIQ CX™" },
      {
        property: "og:description",
        content: "The control centre for tenant-wide AegisIQ CX configuration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdministrationLayout,
});

export const ADMIN_SECTIONS = [
  { title: "Overview", url: "/administration", icon: Activity, exact: true },
  { title: "General", url: "/administration/general", icon: Cog },
  { title: "Company", url: "/settings", icon: Building2, external: true },
  { title: "Languages", url: "/administration/languages", icon: Languages },
  { title: "Keywords", url: "/administration/keywords", icon: Tags },
  { title: "AI Settings", url: "/administration/ai", icon: Sparkles },
  { title: "Speech Settings", url: "/administration/speech", icon: Waves },
  { title: "Alerts", url: "/administration/alerts", icon: BellRing },
  { title: "Security", url: "/administration/security", icon: ShieldCheck },
  { title: "Integrations", url: "/administration/integrations", icon: Plug },
  { title: "API Keys", url: "/administration/api-keys", icon: KeyRound },
  { title: "Audit Logs", url: "/audit-logs", icon: ScrollText, external: true },
  { title: "Metered Usage", url: "/administration/usage", icon: Gauge },
  { title: "Copilot Quotas", url: "/administration/quotas", icon: Wallet },
  { title: "Licensing", url: "/administration/licensing", icon: Cpu },
  { title: "Backup", url: "/administration/backup", icon: DatabaseBackup },
] as const;

function AdministrationLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div>
      <PageHeader
        title="Enterprise Administration"
        description="System-wide configuration for this tenant — identity, intelligence engines, security posture, integrations and lifecycle governance."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Administration sections"
          className="panel flex gap-1 overflow-x-auto p-2 lg:sticky lg:top-4 lg:h-fit lg:flex-col lg:overflow-visible"
        >
          {ADMIN_SECTIONS.map((item) => {
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
