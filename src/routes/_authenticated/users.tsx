import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";

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
import { outletsQuery, staffQuery } from "@/features/platform/queries";
import { ROLE_LABELS } from "@/features/auth/useSession";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users & roles — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Tenant user directory with role-based access control across super admin, tenant admin, regional and outlet tiers.",
      },
      { property: "og:title", content: "Users & roles — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Tenant user directory and role-based access control.",
      },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { data, isPending, error, refetch } = useQuery(staffQuery);
  const outlets = useQuery(outletsQuery);
  const [term, setTerm] = useState("");
  const [role, setRole] = useState("all");

  const outletName = useMemo(() => {
    const map = new Map((outlets.data ?? []).map((o) => [o.id, o.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "Unassigned") : "Head office");
  }, [outlets.data]);

  const rows = (data ?? []).filter((u) => {
    if (role !== "all" && u.directory_role !== role) return false;
    const q = term.trim().toLowerCase();
    if (!q) return true;
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Users"
        description="People with access to this tenant workspace, their assigned outlet and permission tier."
        actions={
          <Button size="sm">
            <UserPlus className="mr-2 size-4" /> Invite user
          </Button>
        }
      />

      <Panel
        title={`${rows.length} users`}
        description="Role assignments are enforced by row-level security on every request"
      >
        <div className="mb-5 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search name or email"
              className="bg-surface pl-9"
              maxLength={80}
            />
          </div>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full bg-surface md:w-60">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isPending ? (
          <LoadingState rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No users match this filter"
            description="Adjust the role filter or invite a new team member to this tenant."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Job title</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((user) => (
                  <TableRow key={user.id} className="border-border">
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="bg-primary/12 text-[10px] text-primary">
                            {user.full_name
                              .split(" ")
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{user.full_name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-xs">{user.job_title}</TableCell>
                    <TableCell className="text-xs">{outletName(user.outlet_id)}</TableCell>
                    <TableCell className="text-xs">{ROLE_LABELS[user.directory_role]}</TableCell>
                    <TableCell>
                      <StatusPill
                        label={user.status}
                        tone={user.status === "active" ? "positive" : "neutral"}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatRelative(user.last_active_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
