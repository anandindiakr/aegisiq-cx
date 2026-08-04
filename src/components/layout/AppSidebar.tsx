import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Radar,
  MessagesSquare,
  Search,
  BrainCircuit,
  Tags,
  Languages,
  ShieldAlert,
  Siren,
  MonitorPlay,
  FileBarChart,
  Sparkles,
  Store,
  Cctv,
  Users,
  Settings,
  ScrollText,
  UserCircle2,
  Timer,
  KeyRound,
  Bookmark,
  BellRing,
  Bot,
  FileText,
  ServerCog,
  AudioLines,
  Activity,
  Network,
  Database,
  Gauge,
  Wallet,
  ShieldHalf,
  ClipboardList,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { companyQuery } from "@/features/platform/queries";

const OPERATIONS = [
  { title: "Command Centre", url: "/command-centre", icon: Radar },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Live Monitor", url: "/live-monitor", icon: MonitorPlay },
  { title: "Alert Centre", url: "/alert-centre", icon: Siren },
  { title: "Alert Analytics", url: "/alert-analytics", icon: ShieldAlert },
  { title: "Alerts", url: "/alerts", icon: Siren },
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "Filter Presets", url: "/filter-presets", icon: Bookmark },
  { title: "Notifications", url: "/notifications", icon: BellRing },
  { title: "My Reports", url: "/copilot/reports", icon: Bot },
  { title: "Report Alerts", url: "/copilot/notifications", icon: BellRing },
  { title: "Report Templates", url: "/copilot/report-templates", icon: FileText },
  { title: "AI Assistant", url: "/assistant", icon: Sparkles },
];

const CONVERSATION_IQ = [
  { title: "Conversations", url: "/conversationiq", icon: MessagesSquare },
  { title: "Search", url: "/conversationiq/search", icon: Search },
  { title: "AI Review", url: "/conversationiq/review", icon: BrainCircuit },
  { title: "Keywords", url: "/conversationiq/keywords", icon: Tags },
  { title: "Languages", url: "/conversationiq/languages", icon: Languages },
  { title: "SLA Policies", url: "/conversationiq/sla", icon: Timer },
];

const ESTATE = [
  { title: "Outlets", url: "/outlets", icon: Store },
  { title: "Cameras", url: "/cameras", icon: Cctv },
  { title: "Users", url: "/users", icon: Users },
  { title: "Roles & Access", url: "/admin/roles", icon: KeyRound },
];

const INFRASTRUCTURE = [
  { title: "Camera Management", url: "/infrastructure/cameras", icon: Cctv },
  { title: "Edge Gateways", url: "/infrastructure/gateways", icon: ServerCog },
  { title: "AI Engines", url: "/infrastructure/engines", icon: BrainCircuit },
  { title: "Audio Streams", url: "/infrastructure/audio", icon: AudioLines },
  { title: "Device Health", url: "/infrastructure/health", icon: Activity },
  { title: "Network", url: "/infrastructure/network", icon: Network },
  { title: "Storage", url: "/infrastructure/storage", icon: Database },
];

const GOVERNANCE = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Audit Logs", url: "/audit-logs", icon: ScrollText },
  { title: "Copilot Audit", url: "/admin/copilot-audit", icon: Bot },
  { title: "Metered Usage", url: "/administration/usage", icon: Gauge },
  { title: "Copilot Quotas", url: "/administration/quotas", icon: Wallet },
  { title: "Customer Onboarding", url: "/administration/onboarding", icon: ClipboardList },
  { title: "Platform Console", url: "/platform", icon: ShieldHalf },
  { title: "Profile", url: "/profile", icon: UserCircle2 },
];

function NavGroup({
  label,
  items,
  collapsed,
  pathname,
}: {
  label: string;
  items: typeof OPERATIONS;
  collapsed: boolean;
  pathname: string;
}) {
  return (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate text-sm">{item.title}</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: company } = useQuery(companyQuery);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <Link to="/command-centre" className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={`${company.name} logo`}
                className="size-full object-contain"
              />
            ) : (
              <img
                src="/aegisiqcx-icon-192.png"
                alt="AegisIQ CX"
                className="size-5 object-contain"
              />
            )}
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight">
                {company?.name ?? "AegisIQ CX™"}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {company?.brand_tagline ?? "CX Intelligence Platform"}
              </span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <NavGroup
          label="Intelligence"
          items={OPERATIONS}
          collapsed={collapsed}
          pathname={pathname}
        />
        <NavGroup
          label="ConversationIQ™"
          items={CONVERSATION_IQ}
          collapsed={collapsed}
          pathname={pathname}
        />
        <NavGroup label="Estate" items={ESTATE} collapsed={collapsed} pathname={pathname} />
        <NavGroup
          label="Infrastructure"
          items={INFRASTRUCTURE}
          collapsed={collapsed}
          pathname={pathname}
        />
        <NavGroup label="Governance" items={GOVERNANCE} collapsed={collapsed} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
            <p className="text-[11px] font-medium text-sidebar-foreground">Platform status</p>
            <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" />
              All ingestion services operational
            </p>
          </div>
        ) : (
          <span className="mx-auto block size-1.5 rounded-full bg-success" />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
