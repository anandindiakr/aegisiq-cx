import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SHARE_DURATIONS,
  createPresetShareLink,
  deletePresetShareLink,
  presetShareLinksQuery,
  revokePresetShareLink,
  shareLinkState,
  shareLinkUrl,
} from "@/features/command-centre/presetShares";
import type { FilterPreset } from "@/features/command-centre/presets";
import { ASSIGNABLE_ROLES } from "@/features/platform/roles";
import type { AppRole } from "@/features/platform/queries";

/**
 * Issues expiring, role-checked links to a preset. Recipients open a read-only
 * view of the filters — they can apply them but never change the preset itself.
 */
export function PresetShareDialog({
  preset,
  onOpenChange,
}: {
  preset: FilterPreset | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const links = useQuery(presetShareLinksQuery);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(7);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const scoped = (links.data ?? []).filter((link) => link.preset_id === preset?.id);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: presetShareLinksQuery.queryKey });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  const create = useMutation({
    mutationFn: () =>
      createPresetShareLink({
        presetId: preset!.id,
        label: label.trim() || null,
        allowedRoles: roles,
        expiresInDays: days,
      }),
    onSuccess: async (link) => {
      await refresh();
      setLabel("");
      await copy(shareLinkUrl(link));
    },
    onError: (error: Error) => toast.error("Could not create link", { description: error.message }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokePresetShareLink(id),
    onSuccess: async () => {
      await refresh();
      toast.success("Link revoked");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePresetShareLink(id),
    onSuccess: refresh,
  });

  const toggleRole = (role: AppRole) =>
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  return (
    <Dialog open={Boolean(preset)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share “{preset?.name}”</DialogTitle>
          <DialogDescription>
            Recipients open a read-only copy of this view. Links expire automatically and can be
            limited to specific roles.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Label (optional)</Label>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Board pack — October"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expires after</Label>
            <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHARE_DURATIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)} className="text-sm">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">
              Restrict to roles{" "}
              <span className="text-muted-foreground">(leave empty for anyone signed in)</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {ASSIGNABLE_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={
                    roles.includes(role)
                      ? "rounded-full border border-primary/50 bg-primary/15 px-3 py-1 text-[11px] capitalize text-primary"
                      : "rounded-full border border-border px-3 py-1 text-[11px] capitalize text-muted-foreground hover:border-primary/40"
                  }
                >
                  {role.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button
          className="gap-2 self-start"
          disabled={create.isPending || !preset}
          onClick={() => create.mutate()}
        >
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Link2 className="size-4" />
          )}
          Create link & copy
        </Button>

        <div className="space-y-2">
          {scoped.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No share links issued for this preset yet.
            </p>
          )}
          {scoped.map((link) => {
            const state = shareLinkState(link);
            return (
              <div
                key={link.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-surface/40 p-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {link.label ?? "Untitled link"}
                    <Badge
                      variant={state === "active" ? "outline" : "secondary"}
                      className="text-[10px] capitalize"
                    >
                      {state}
                    </Badge>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Expires {new Date(link.expires_at).toLocaleString("en-GB")} · {link.view_count}{" "}
                    view{link.view_count === 1 ? "" : "s"} ·{" "}
                    {link.allowed_roles.length === 0
                      ? "any signed-in user"
                      : link.allowed_roles.map((r) => r.replace(/_/g, " ")).join(", ")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => void copy(shareLinkUrl(link))}
                  aria-label="Copy share link"
                >
                  <Copy className="size-4" />
                </Button>
                {state === "active" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => revoke.mutate(link.id)}
                    aria-label="Revoke share link"
                  >
                    <XCircle className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(link.id)}
                  aria-label="Delete share link"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
