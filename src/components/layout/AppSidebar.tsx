import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessagesSquare,
  Siren,
  FileBarChart,
  Sparkles,
  Store,
  Cctv,
  Users,
  Settings,
  ScrollText,
  UserCircle2,
  ShieldCheck,
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

const OPERATIONS = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "ConversationIQ™", url: "/conversations", icon: MessagesSquare },
  { title: "Alerts", url: "/alerts", icon: Siren },
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "AI Assistant", url: "/assistant", icon: Sparkles },
];

const ESTATE = [
  { title: "Outlets", url: "/outlets", icon: Store },
  { title: "Cameras", url: "/cameras", icon: Cctv },
  { title: "Users", url: "/users", icon: Users },
];

const GOVERNANCE = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Audit Logs", url: "/audit-logs", icon: ScrollText },
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

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <Link to="/dashboard" className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
            <ShieldCheck className="size-5" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight">
                AegisIQ CX™
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                CX Intelligence Platform
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
        <NavGroup label="Estate" items={ESTATE} collapsed={collapsed} pathname={pathname} />
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
