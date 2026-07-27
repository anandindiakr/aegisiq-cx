import { type ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Search, ShieldCheck } from "lucide-react";

import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, useSession } from "@/features/auth/useSession";
import { companyQuery, myProfileQuery, myRolesQuery } from "@/features/platform/queries";
import { applyBrandColor } from "@/features/platform/branding";
import { useAlertRealtime } from "@/features/platform/realtime";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: profile } = useQuery(myProfileQuery);
  const { data: roles } = useQuery(myRolesQuery);
  const { data: company } = useQuery(companyQuery);

  // Tenant branding: paint the company colour into the design tokens.
  useEffect(() => {
    applyBrandColor(company?.brand_primary_color);
  }, [company?.brand_primary_color]);

  // Live alert stream (toasts + cache refresh) for the whole console.
  useAlertRealtime(company?.id);

  const displayName = profile?.full_name ?? user?.email ?? "Operator";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl md:px-6">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="hidden min-w-0 items-center gap-2 md:flex">
              {company?.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={`${company.name} logo`}
                  className="size-5 rounded object-contain"
                  loading="lazy"
                />
              ) : (
                <ShieldCheck className="size-4 text-primary" />
              )}
              <span className="truncate text-sm font-medium">
                {company?.name ?? "Loading tenant…"}
              </span>
              <Badge variant="outline" className="border-primary/30 text-primary">
                {(company?.subscription_plan ?? "enterprise").toUpperCase()}
              </Badge>
            </div>

            <div className="relative ml-auto hidden w-72 lg:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search conversations, outlets, alerts…"
                className="h-9 bg-surface pl-9"
                aria-label="Global search"
              />
            </div>

            <Button variant="ghost" size="icon" className="ml-auto lg:ml-0" aria-label="Alerts">
              <Bell className="size-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 px-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary/15 text-xs text-primary">
                      {initials || "AI"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left md:block">
                    <span className="block max-w-36 truncate text-xs font-medium">
                      {displayName}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {ROLE_LABELS[roles?.[0] ?? "viewer"]}
                    </span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
