import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Plus, Trash2 } from "lucide-react";

import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  createSsoMapping,
  deleteSsoMapping,
  outletsQuery,
  ssoMappingsQuery,
  updateSsoMapping,
} from "@/features/platform/queries";
import type { AppRole } from "@/features/platform/queries";
import { ROLE_LABELS } from "@/features/auth/useSession";

const ROLES: AppRole[] = [
  "tenant_admin",
  "regional_manager",
  "outlet_manager",
  "supervisor",
  "viewer",
];

const EMPTY = {
  provider: "saml",
  claim_key: "groups",
  claim_value: "",
  role: "viewer" as AppRole,
  outlet_id: "none",
  priority: 100,
};

/**
 * Claim -> role/outlet mapping table.
 *
 * Each row says: when the identity provider asserts `claim_key = claim_value`
 * for a user, grant `role` (and optionally pin them to an outlet) on their
 * next sign-in. Lower priority numbers win when several rows match.
 */
export function SsoMappings() {
  const { data, isPending, error, refetch } = useQuery(ssoMappingsQuery);
  const outlets = useQuery(outletsQuery);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sso-mappings"] });

  const create = useMutation({
    mutationFn: () => {
      if (!form.claim_key.trim() || !form.claim_value.trim()) {
        throw new Error("Claim name and claim value are both required");
      }
      return createSsoMapping({
        provider: form.provider,
        claim_key: form.claim_key.trim(),
        claim_value: form.claim_value.trim(),
        role: form.role,
        outlet_id: form.outlet_id === "none" ? null : form.outlet_id,
        priority: Number(form.priority) || 100,
        is_active: true,
      });
    },
    onSuccess: () => {
      toast.success("Mapping added");
      setForm(EMPTY);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateSsoMapping(id, { is_active }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSsoMapping(id),
    onSuccess: () => {
      toast.success("Mapping removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const outletName = (id: string | null) =>
    id ? ((outlets.data ?? []).find((o) => o.id === id)?.name ?? "—") : "Estate-wide";

  return (
    <div className="space-y-4">
      <Panel
        title="Claim mapping rules"
        description="Roles and outlet assignment are applied automatically from SAML/OIDC claims at each sign-in"
      >
        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isPending ? (
          <LoadingState rows={4} />
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            title="No mappings configured"
            description="Add a rule below to grant roles from your identity provider's group or department claims."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Claim</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Role granted</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((m) => (
                  <TableRow key={m.id} className="border-border">
                    <TableCell className="font-mono text-xs">
                      <KeyRound className="mr-1.5 inline size-3 text-primary" />
                      {m.claim_key}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{m.claim_value}</TableCell>
                    <TableCell className="text-xs">{ROLE_LABELS[m.role] ?? m.role}</TableCell>
                    <TableCell className="text-xs">{outletName(m.outlet_id)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.priority}</TableCell>
                    <TableCell>
                      <Switch
                        checked={m.is_active}
                        onCheckedChange={(v) => toggle.mutate({ id: m.id, is_active: v })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove.mutate(m.id)}
                        disabled={remove.isPending}
                        aria-label={`Remove mapping ${m.claim_key}=${m.claim_value}`}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Panel title="Add mapping" description="Lower priority numbers take precedence when several rules match">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Provider</Label>
            <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger className="bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saml">SAML</SelectItem>
                <SelectItem value="oidc">OIDC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Claim name</Label>
            <Input
              className="bg-surface"
              value={form.claim_key}
              maxLength={120}
              onChange={(e) => setForm({ ...form, claim_key: e.target.value })}
              placeholder="groups"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Claim value</Label>
            <Input
              className="bg-surface"
              value={form.claim_value}
              maxLength={160}
              onChange={(e) => setForm({ ...form, claim_value: e.target.value })}
              placeholder="cx-regional-managers"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Role</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v as AppRole })}
            >
              <SelectTrigger className="bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r] ?? r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Outlet</Label>
            <Select
              value={form.outlet_id}
              onValueChange={(v) => setForm({ ...form, outlet_id: v })}
            >
              <SelectTrigger className="bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Estate-wide</SelectItem>
                {(outlets.data ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Priority</Label>
            <Input
              className="bg-surface"
              type="number"
              min={1}
              max={999}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="mr-2 size-4" /> Add mapping
          </Button>
        </div>
      </Panel>
    </div>
  );
}
