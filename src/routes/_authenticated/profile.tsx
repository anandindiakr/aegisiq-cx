import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";

import {
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, useSession } from "@/features/auth/useSession";
import {
  companyQuery,
  myProfileQuery,
  myRolesQuery,
  outletsQuery,
} from "@/features/platform/queries";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { IqAccessPanel } from "@/components/settings/IqAccessPanel";
import { formatDateTime, formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Your AegisIQ CX account: assigned tenant, outlet, granted roles, session details and sign-out.",
      },
      { property: "og:title", content: "My profile — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Your account, assigned tenant, outlet and granted roles.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useSession();
  const profile = useQuery(myProfileQuery);
  const roles = useQuery(myRolesQuery);
  const company = useQuery(companyQuery);
  const outlets = useQuery(outletsQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const outletName =
    (outlets.data ?? []).find((o) => o.id === profile.data?.outlet_id)?.name ?? "Head office";
  const initials = (profile.data?.full_name ?? user?.email ?? "?")
    .split(/[\s@.]/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div>
      <PageHeader
        title="My profile"
        description="Your identity inside this tenant workspace and the permissions granted to your account."
        actions={
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        }
      />

      {profile.error ? (
        <ErrorState message={profile.error.message} onRetry={() => profile.refetch()} />
      ) : profile.isPending ? (
        <LoadingState rows={5} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Account" className="lg:col-span-2">
            <div className="flex items-start gap-4">
              <Avatar className="size-14">
                <AvatarFallback className="bg-primary/12 text-base text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-lg font-semibold">{profile.data?.full_name ?? "Unnamed user"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.data?.status ? (
                    <StatusPill
                      label={profile.data.status}
                      tone={profile.data.status === "active" ? "positive" : "neutral"}
                    />
                  ) : null}
                  {(roles.data ?? []).map((role) => (
                    <Badge key={role} variant="outline" className="border-border text-xs">
                      <ShieldCheck className="mr-1.5 size-3 text-primary" />
                      {ROLE_LABELS[role] ?? role}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
              <Field label="Job title" value={profile.data?.job_title ?? "—"} />
              <Field label="Phone" value={profile.data?.phone ?? "—"} />
              <Field label="Assigned outlet" value={outletName} />
              <Field label="Last active" value={formatRelative(profile.data?.last_active_at)} />
            </dl>
          </Panel>

          <Panel title="Tenant" description="Workspace your account is scoped to">
            <dl className="grid gap-4">
              <Field label="Company" value={company.data?.name ?? "—"} />
              <Field
                label="Plan"
                value={(company.data?.subscription_plan ?? "—").replace(/_/g, " ")}
              />
              <Field label="Time zone" value={company.data?.timezone ?? "—"} />
              <Field
                label="Session started"
                value={formatDateTime(user?.last_sign_in_at ?? null)}
              />
            </dl>
          </Panel>

          <div className="lg:col-span-2">
            <NotificationSettings />
          </div>

          <IqAccessPanel />
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium capitalize">{value}</dd>
    </div>
  );
}
