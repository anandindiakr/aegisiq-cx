import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, LayoutTemplate, Plus, Trash2, Users2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Chip } from "@/components/conversationiq/Badges";
import { ROLE_LABELS } from "@/features/auth/useSession";
import {
  CAPABILITY_LABELS,
  allowedRoles,
  type IqCapability,
} from "@/features/conversationiq/access";
import { companyQuery, type AppRole } from "@/features/platform/queries";
import { ASSIGNABLE_ROLES, roleGrantsQuery, type CompanyMember } from "@/features/platform/roles";
import {
  activeCapabilityMatrixQuery,
  applyTemplateToMembers,
  cloneTemplate,
  createTemplate,
  deleteTemplate,
  roleTemplatesQuery,
  setActiveTemplate,
  updateTemplate,
  type CapabilityMatrix,
  type RoleTemplate,
} from "@/features/platform/roleTemplates";
import { formatDate } from "@/lib/format";

const CAPABILITIES = Object.keys(CAPABILITY_LABELS) as IqCapability[];

/** Builds a full matrix object from the current effective permissions. */
function matrixFrom(override?: CapabilityMatrix | null): CapabilityMatrix {
  const out: CapabilityMatrix = {};
  for (const capability of CAPABILITIES) out[capability] = [...allowedRoles(capability, override)];
  return out;
}

export interface RoleTemplatesPanelProps {
  members: CompanyMember[];
}

/**
 * Reusable permission matrices. A template bundles the roles it grants and the
 * capability matrix the workspace should run on, and shared templates can be
 * adopted by any other workspace without rebuilding permissions by hand.
 */
export function RoleTemplatesPanel({ members }: RoleTemplatesPanelProps) {
  const queryClient = useQueryClient();
  const templates = useQuery(roleTemplatesQuery);
  const company = useQuery(companyQuery);
  const active = useQuery(activeCapabilityMatrixQuery);
  const activeId = active.data?.id ?? null;

  const [editor, setEditor] = useState<{
    id: string | null;
    name: string;
    description: string;
    roles: AppRole[];
    capabilities: CapabilityMatrix;
    isShared: boolean;
  } | null>(null);
  const [applying, setApplying] = useState<RoleTemplate | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const assignable = useMemo(
    () => members.filter((member) => Boolean(member.profile.user_id)),
    [members],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: roleTemplatesQuery.queryKey });
    void queryClient.invalidateQueries({ queryKey: activeCapabilityMatrixQuery.queryKey });
    void queryClient.invalidateQueries({ queryKey: roleGrantsQuery.queryKey });
    void queryClient.invalidateQueries({ queryKey: companyQuery.queryKey });
    void queryClient.invalidateQueries({ queryKey: ["my-roles"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!editor) return;
      const payload = {
        name: editor.name,
        description: editor.description,
        roles: editor.roles,
        capabilities: editor.capabilities,
        isShared: editor.isShared,
      };
      if (editor.id) await updateTemplate(editor.id, payload);
      else await createTemplate(payload);
    },
    onSuccess: () => {
      toast.success("Template saved");
      setEditor(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activate = useMutation({
    mutationFn: (id: string | null) => setActiveTemplate(id),
    onSuccess: (_data, id) => {
      toast.success(id ? "Template applied to this workspace" : "Reverted to default permissions");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clone = useMutation({
    mutationFn: (template: RoleTemplate) => cloneTemplate(template),
    onSuccess: () => {
      toast.success("Copied into this workspace");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      toast.success("Template deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const applyRoles = useMutation({
    mutationFn: async () => {
      if (!applying) return { granted: 0, revoked: 0, failures: [] as string[] };
      const chosen = assignable
        .filter((member) => picked.has(member.profile.id))
        .map((member) => ({
          userId: member.profile.user_id as string,
          currentGrants: member.grants.map((g) => ({ id: g.id, role: g.role })),
        }));
      return applyTemplateToMembers(applying, chosen);
    },
    onSuccess: (result) => {
      if (result.failures.length > 0) {
        toast.warning(
          `Applied with ${result.failures.length} skipped change(s) — row-level security blocked some grants.`,
        );
      } else {
        toast.success(`Granted ${result.granted} and revoked ${result.revoked} role(s)`);
      }
      setApplying(null);
      setPicked(new Set());
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = templates.data ?? [];

  return (
    <Panel
      title="Role templates"
      description="Save a permission matrix once and reuse it — across teams, and across companies through shared templates."
      actions={
        <Button
          size="sm"
          onClick={() =>
            setEditor({
              id: null,
              name: `${company.data?.name ?? "Workspace"} matrix`,
              description: "",
              roles: ["tenant_admin", "regional_manager", "outlet_manager", "supervisor"],
              capabilities: matrixFrom(active.data?.capabilities),
              isShared: false,
            })
          }
        >
          <Plus className="mr-1.5 size-3.5" /> New template
        </Button>
      }
    >
      {templates.isPending && <LoadingState />}
      {templates.error && (
        <ErrorState
          message={(templates.error as Error).message}
          onRetry={() => void templates.refetch()}
        />
      )}
      {!templates.isPending && rows.length === 0 && (
        <EmptyState
          title="No templates yet"
          description="Create one from the current permission matrix, or adopt a shared template from another workspace."
        />
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((template) => {
          const isActive = template.id === activeId;
          const owned = template.company_id !== null;
          const permissionCount = Object.values(template.capabilities).filter(
            (list) => (list ?? []).length > 0,
          ).length;
          return (
            <div
              key={template.id}
              className={`rounded-xl border p-4 ${
                isActive ? "border-primary/60 bg-primary/5" : "border-border/60 bg-surface"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <LayoutTemplate className="size-4 text-muted-foreground" />
                    {template.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {template.description ?? "No description"}
                  </p>
                </div>
                {isActive ? <Chip tone="positive">Active</Chip> : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {template.roles.map((role) => (
                  <Chip key={role} tone="info">
                    {ROLE_LABELS[role] ?? role}
                  </Chip>
                ))}
                {template.is_shared && <Chip tone="neutral">Shared</Chip>}
                {!owned && <Chip tone="neutral">Platform</Chip>}
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {permissionCount} of {CAPABILITIES.length} permissions defined · updated{" "}
                {formatDate(template.updated_at)}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={isActive ? "outline" : "default"}
                  disabled={activate.isPending}
                  onClick={() => activate.mutate(isActive ? null : template.id)}
                >
                  <Check className="mr-1.5 size-3.5" />
                  {isActive ? "Deactivate" : "Use this matrix"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setApplying(template);
                    setPicked(new Set());
                  }}
                >
                  <Users2 className="mr-1.5 size-3.5" /> Apply to people
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={clone.isPending}
                  onClick={() => clone.mutate(template)}
                >
                  <Copy className="mr-1.5 size-3.5" /> Duplicate
                </Button>
                {owned && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditor({
                          id: template.id,
                          name: template.name,
                          description: template.description ?? "",
                          roles: template.roles,
                          capabilities: matrixFrom(template.capabilities),
                          isShared: template.is_shared,
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(template.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor */}
      <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editor?.id ? "Edit template" : "New role template"}</DialogTitle>
            <DialogDescription>
              Tick which roles unlock each permission. Share the template to let other workspaces
              adopt the same matrix.
            </DialogDescription>
          </DialogHeader>

          {editor && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="template-name">Name</Label>
                  <Input
                    id="template-name"
                    value={editor.name}
                    onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                    className="bg-surface"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="template-description">Description</Label>
                  <Textarea
                    id="template-description"
                    rows={2}
                    value={editor.description}
                    onChange={(event) => setEditor({ ...editor, description: event.target.value })}
                    className="bg-surface"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Roles this template grants</p>
                <div className="flex flex-wrap gap-3">
                  {ASSIGNABLE_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editor.roles.includes(role)}
                        onCheckedChange={(checked) =>
                          setEditor({
                            ...editor,
                            roles: checked
                              ? [...editor.roles, role]
                              : editor.roles.filter((r) => r !== role),
                          })
                        }
                      />
                      {ROLE_LABELS[role] ?? role}
                    </label>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-[11px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Permission</th>
                      {ASSIGNABLE_ROLES.map((role) => (
                        <th key={role} className="px-2 py-2 text-center font-medium">
                          {ROLE_LABELS[role] ?? role}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {CAPABILITIES.map((capability) => (
                      <tr key={capability}>
                        <td className="px-3 py-2">{CAPABILITY_LABELS[capability]}</td>
                        {ASSIGNABLE_ROLES.map((role) => {
                          const list = editor.capabilities[capability] ?? [];
                          return (
                            <td key={role} className="px-2 py-2 text-center">
                              <Checkbox
                                checked={list.includes(role)}
                                onCheckedChange={(checked) =>
                                  setEditor({
                                    ...editor,
                                    capabilities: {
                                      ...editor.capabilities,
                                      [capability]: checked
                                        ? [...list, role]
                                        : list.filter((r) => r !== role),
                                    },
                                  })
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={editor.isShared}
                  onCheckedChange={(checked) =>
                    setEditor({ ...editor, isShared: Boolean(checked) })
                  }
                />
                Share this template with other workspaces
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply roles to people */}
      <Dialog open={applying !== null} onOpenChange={(open) => !open && setApplying(null)}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply “{applying?.name}” to people</DialogTitle>
            <DialogDescription>
              Selected members receive every role in the template, and lose workspace roles it does
              not include. Super admin grants are never touched.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {assignable.map((member) => (
              <label
                key={member.profile.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={picked.has(member.profile.id)}
                  onCheckedChange={(checked) =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(member.profile.id);
                      else next.delete(member.profile.id);
                      return next;
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{member.profile.full_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.roles.map((role) => ROLE_LABELS[role] ?? role).join(", ") || "No roles"}
                  </span>
                </span>
              </label>
            ))}
            {assignable.length === 0 && (
              <p className="text-sm text-muted-foreground">No members with a linked account yet.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApplying(null)}>
              Cancel
            </Button>
            <Button
              disabled={picked.size === 0 || applyRoles.isPending}
              onClick={() => applyRoles.mutate()}
            >
              Apply to {picked.size} member{picked.size === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
