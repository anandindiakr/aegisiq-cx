import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Cctv, Cpu, ServerCog, ShieldCheck, Store, UserCog, Users } from "lucide-react";

import { EmptyState, LoadingState, MetricCard, Panel, StatusPill } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  camerasQuery,
  companyQuery,
  outletsQuery,
  staffQuery,
  type AppRole,
} from "@/features/platform/queries";
import { ASSIGNABLE_ROLES, grantRole, mergeMembers, revokeRole, roleGrantsQuery } from "@/features/platform/roles";
import { aiEnginesQuery, edgeGatewaysQuery } from "@/features/infrastructure/queries";
import { ROLE_LABELS } from "@/features/auth/useSession";

export const Route = createFileRoute("/_authenticated/platform/")({
  component: PlatformControlCentre,
});

function PlatformControlCentre() {
  const queryClient = useQueryClient();
  const company = useQuery(companyQuery);
  const outlets = useQuery(outletsQuery);
  const cameras = useQuery(camerasQuery);
  const gateways = useQuery(edgeGatewaysQuery);
  const engines = useQuery(aiEnginesQuery);
  const staff = useQuery(staffQuery);
  const grants = useQuery(roleGrantsQuery);

  const grant = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) => grantRole(userId, role),
    onSuccess: () => {
      toast.success("Role granted");
      void queryClient.invalidateQueries({ queryKey: ["platform", "role-grants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (grantId: string) => revokeRole(grantId),
    onSuccess: () => {
      toast.success("Role revoked");
      void queryClient.invalidateQueries({ queryKey: ["platform", "role-grants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const members =
    staff.data && grants.data ? mergeMembers(staff.data, grants.data) : [];

  const onlineGateways = (gateways.data ?? []).filter((g) => g.status === "online").length;
  const healthyEngines = (engines.data ?? []).filter((e) => e.health === "healthy").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Workspace"
          value={company.data?.name ?? "—"}
          hint="Active tenant under management"
          icon={Building2}
          index={0}
        />
        <MetricCard
          label="Outlets"
          value={String((outlets.data ?? []).length)}
          hint="Sites streaming into the platform"
          icon={Store}
          index={1}
        />
        <MetricCard
          label="Cameras"
          value={String((cameras.data ?? []).length)}
          hint="Registered capture devices"
          icon={Cctv}
          index={2}
        />
        <MetricCard
          label="Edge compute"
          value={`${onlineGateways}/${(gateways.data ?? []).length}`}
          hint="Gateways online"
          icon={ServerCog}
          index={3}
        />
        <MetricCard
          label="AI engines"
          value={`${healthyEngines}/${(engines.data ?? []).length}`}
          hint="Inference services healthy"
          icon={Cpu}
          index={4}
        />
        <MetricCard
          label="Directory"
          value={String((staff.data ?? []).length)}
          hint="People with platform access"
          icon={Users}
          index={5}
        />
      </div>

      <Panel
        title="Identity & access"
        description="Grant or revoke platform roles for anyone in the directory. Role changes take effect on their next request."
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to="/admin/roles">
              <ShieldCheck className="size-4" /> Role templates
            </Link>
          </Button>
        }
      >
        {staff.isPending || grants.isPending ? (
          <LoadingState rows={5} />
        ) : members.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Person</th>
                  <th className="pb-2 pr-3 font-medium">Roles</th>
                  <th className="pb-2 font-medium">Grant role</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.profile.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-3">
                      <p className="text-sm font-medium">{member.profile.full_name}</p>
                      <p className="text-xs text-muted-foreground">{member.profile.email ?? "—"}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1.5">
                        {member.grants.length ? (
                          member.grants.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => revoke.mutate(g.id)}
                              title="Revoke this role"
                              className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                            >
                              {ROLE_LABELS[g.role] ?? g.role} ✕
                            </button>
                          ))
                        ) : (
                          <StatusPill label="no roles" tone="warning" />
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <Select
                        onValueChange={(role) =>
                          grant.mutate({
                            userId: member.profile.user_id,
                            role: role as AppRole,
                          })
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Add role…" />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.filter((r) => !member.roles.includes(r)).map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r] ?? r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No directory entries" description="Invite users to populate the directory." />
        )}
      </Panel>

      <Panel title="Jump to" description="Everything a super admin operates day to day">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Metered usage", to: "/platform/usage", icon: UserCog },
            { label: "Pricing configurator", to: "/platform/pricing", icon: Building2 },
            { label: "Edge & connections", to: "/platform/edge", icon: ServerCog },
            { label: "Enterprise administration", to: "/administration", icon: ShieldCheck },
            { label: "Copilot quotas", to: "/administration/quotas", icon: Cpu },
            { label: "Audit logs", to: "/audit-logs", icon: Users },
          ].map((item) => (
            <Button key={item.to} variant="outline" className="justify-start" asChild>
              <Link to={item.to}>
                <item.icon className="size-4" /> {item.label}
              </Link>
            </Button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
