import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Search, ShieldAlert, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Chip } from "@/components/conversationiq/Badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRoles } from "@/features/platform/tenant";
import { staffQuery, type AppRole } from "@/features/platform/queries";
import {
  ASSIGNABLE_ROLES,
  grantRole,
  mergeMembers,
  revokeRole,
  roleGrantsQuery,
  setDirectoryRole,
} from "@/features/platform/roles";
import { CAPABILITY_LABELS, can, type IqCapability } from "@/features/conversationiq/access";
import { ROLE_LABELS } from "@/features/auth/useSession";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  beforeLoad: ({ context }) => requireRoles(context.tenant, ["super_admin", "tenant_admin"]),
  head: () => ({
    meta: [
      { title: "Roles & Access — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Grant and revoke workspace roles, review the permissions each tier unlocks, and keep company access aligned with policy.",
      },
      { property: "og:title", content: "Roles & Access — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Company-scoped role administration and permission matrix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoleAdminPage,
});

const CAPABILITIES = Object.keys(CAPABILITY_LABELS) as IqCapability[];

function RoleAdminPage() {
  const queryClient = useQueryClient();
  const staff = useQuery(staffQuery);
  const grants = useQuery(roleGrantsQuery);
  const [term, setTerm] = useState("");
  const [pendingRole, setPendingRole] = useState<Record<string, AppRole>>({});

  const members = useMemo(
    () => mergeMembers(staff.data ?? [], grants.data ?? []),
    [staff.data, grants.data],
  );

  const rows = members.filter((member) => {
    const q = term.trim().toLowerCase();
    if (!q) return true;
    return (
      member.profile.full_name.toLowerCase().includes(q) ||
      member.profile.email.toLowerCase().includes(q)
    );
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: roleGrantsQuery.queryKey });
    void queryClient.invalidateQueries({ queryKey: staffQuery.queryKey });
  };

  const grant = useMutation({
    mutationFn: async (input: { userId: string; profileId: string; role: AppRole }) => {
      await grantRole(input.userId, input.role);
      await setDirectoryRole(input.profileId, input.role);
    },
    onSuccess: () => {
      toast.success("Role granted");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revoke = useMutation({
    mutationFn: (grantId: string) => revokeRole(grantId),
    onSuccess: () => {
      toast.success("Role revoked");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Access"
        description="Assign permissions per person in this company. Every change is enforced by row-level security — you cannot alter your own grants, and only a super admin can grant the super admin role."
      />

      <Panel
        title={`${rows.length} workspace members`}
        description="Grants shown here are the live records the database uses to authorise every request."
        actions={
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search people"
              className="h-9 bg-surface pl-9"
            />
          </div>
        }
      >
        {(staff.isPending || grants.isPending) && <LoadingState />}
        {grants.error && (
          <ErrorState message={(grants.error as Error).message} onRetry={() => void grants.refetch()} />
        )}
        {!staff.isPending && !grants.isPending && rows.length === 0 && (
          <EmptyState
            title="No members match"
            description="Try a different name or email, or invite someone from the Users directory."
          />
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Granted roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last active</TableHead>
                  <TableHead className="text-right">Grant a role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((member) => {
                  const userId = member.profile.user_id;
                  const selected = pendingRole[member.profile.id] ?? "viewer";
                  return (
                    <TableRow key={member.profile.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-[11px]">
                              {member.profile.full_name
                                .split(" ")
                                .map((p) => p[0])
                                .slice(0, 2)
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {member.profile.full_name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {member.profile.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {member.grants.length === 0 && (
                            <span className="text-xs text-muted-foreground">No grants</span>
                          )}
                          {member.grants.map((item) => (
                            <span key={item.id} className="inline-flex items-center gap-1">
                              <Chip tone={item.role === "super_admin" ? "negative" : "info"}>
                                {ROLE_LABELS[item.role] ?? item.role}
                              </Chip>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6"
                                title="Revoke role"
                                disabled={revoke.isPending}
                                onClick={() => revoke.mutate(item.id)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusPill label={member.profile.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {member.profile.last_active_at
                          ? formatRelative(member.profile.last_active_at)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            value={selected}
                            onValueChange={(value) =>
                              setPendingRole((prev) => ({
                                ...prev,
                                [member.profile.id]: value as AppRole,
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 w-44 bg-surface">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSIGNABLE_ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role] ?? role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            disabled={!userId || grant.isPending}
                            onClick={() =>
                              userId &&
                              grant.mutate({
                                userId,
                                profileId: member.profile.id,
                                role: selected,
                              })
                            }
                          >
                            <UserCog className="mr-1.5 size-3.5" /> Grant
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Panel
        title="Permission matrix"
        description="What each role tier unlocks across ConversationIQ™. The database enforces the same boundaries."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-64">Permission</TableHead>
                {ASSIGNABLE_ROLES.map((role) => (
                  <TableHead key={role} className="text-center text-[11px]">
                    {ROLE_LABELS[role] ?? role}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {CAPABILITIES.map((capability) => (
                <TableRow key={capability}>
                  <TableCell className="text-sm">
                    <span className="flex items-center gap-2">
                      <KeyRound className="size-3.5 text-muted-foreground" />
                      {CAPABILITY_LABELS[capability]}
                    </span>
                  </TableCell>
                  {ASSIGNABLE_ROLES.map((role) => (
                    <TableCell key={role} className="text-center">
                      {can([role], capability) ? (
                        <Chip tone="positive">Yes</Chip>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          Role changes take effect on the member's next request. Removing every grant leaves a
          person signed in but read-only until a new role is issued.
        </p>
      </Panel>
    </div>
  );
}
