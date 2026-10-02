import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Plus } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusPill,
} from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  camerasQuery,
  conversationsQuery,
  outletsQuery,
  createOutlet,
  updateOutlet,
  type Outlet,
} from "@/features/platform/queries";
import { formatDate, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/outlets")({
  head: () => ({
    meta: [
      { title: "Outlets — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Manage every outlet in the estate: region, time zone, manager, camera coverage and operational status.",
      },
      { property: "og:title", content: "Outlets — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Manage outlets, regions, managers and camera coverage.",
      },
    ],
  }),
  component: OutletsPage,
});

function OutletsPage() {
  const { data, isPending, error, refetch } = useQuery(outletsQuery);
  const cameras = useQuery(camerasQuery);
  const conversations = useQuery(conversationsQuery);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", region: "", manager_name: "", timezone: "" });
  const [newForm, setNewForm] = useState({
    name: "",
    code: "",
    city: "",
    region: "",
    manager_name: "",
    timezone: "Asia/Singapore",
  });
  const create = useMutation({
    mutationFn: () => {
      if (newForm.name.trim().length < 2) throw new Error("Enter an outlet name");
      if (!/^[A-Za-z0-9-]{2,20}$/.test(newForm.code.trim()))
        throw new Error("Code must be 2-20 letters, numbers or dashes");
      return createOutlet(newForm);
    },
    onSuccess: () => {
      toast.success("Outlet added — you can now assign cameras and staff to it");
      queryClient.invalidateQueries({ queryKey: ["outlets"] });
      setCreating(false);
      setNewForm({
        name: "",
        code: "",
        city: "",
        region: "",
        manager_name: "",
        timezone: "Asia/Singapore",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cameraCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cameras.data ?? []) {
      if (!c.outlet_id) continue;
      map.set(c.outlet_id, (map.get(c.outlet_id) ?? 0) + 1);
    }
    return map;
  }, [cameras.data]);

  const conversationCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of conversations.data ?? []) {
      if (!c.outlet_id) continue;
      map.set(c.outlet_id, (map.get(c.outlet_id) ?? 0) + 1);
    }
    return map;
  }, [conversations.data]);

  const save = useMutation({
    mutationFn: () => updateOutlet(editing!.id, form),
    onSuccess: () => {
      toast.success("Outlet updated");
      queryClient.invalidateQueries({ queryKey: ["outlets"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(outlet: Outlet) {
    setEditing(outlet);
    setForm({
      name: outlet.name,
      region: outlet.region ?? "",
      manager_name: outlet.manager_name ?? "",
      timezone: outlet.timezone,
    });
  }

  return (
    <div>
      <PageHeader
        title="Outlets"
        description="Physical locations under this tenant, with regional grouping, ownership and coverage."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-2 size-4" /> Add outlet
          </Button>
        }
      />

      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : isPending ? (
        <LoadingState rows={5} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="No outlets provisioned"
          description="Add your first location to begin capturing conversations."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((outlet) => (
            <div key={outlet.id} className="panel flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{outlet.name}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{outlet.code}</p>
                </div>
                <StatusPill
                  label={outlet.status}
                  tone={outlet.status === "active" ? "positive" : "warning"}
                />
              </div>

              <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {outlet.address}
                  {outlet.city ? `, ${outlet.city}` : ""}
                  {outlet.country ? `, ${outlet.country}` : ""}
                </span>
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Region</dt>
                  <dd className="mt-0.5 font-medium">{outlet.region}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Time zone</dt>
                  <dd className="mt-0.5 font-medium">{outlet.timezone}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Manager</dt>
                  <dd className="mt-0.5 truncate font-medium">{outlet.manager_name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Opened</dt>
                  <dd className="mt-0.5 font-medium">{formatDate(outlet.opened_at)}</dd>
                </div>
              </dl>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs">
                <span className="text-muted-foreground">
                  {cameraCount.get(outlet.id) ?? 0} cameras ·{" "}
                  {formatNumber(conversationCount.get(outlet.id) ?? 0)} conversations
                </span>
                <Button variant="outline" size="sm" onClick={() => openEdit(outlet)}>
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit outlet</DialogTitle>
            <DialogDescription>
              Changes are written to your tenant and captured in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(
              [
                ["name", "Outlet name"],
                ["region", "Region"],
                ["manager_name", "Manager"],
                ["timezone", "Time zone"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={form[key]}
                  maxLength={120}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="bg-surface"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add outlet</DialogTitle>
            <DialogDescription>
              Register a new store. Cameras, gateways and staff can then be assigned to it.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            {(
              [
                ["name", "Outlet name *", "Orchard Flagship"],
                ["code", "Outlet code *", "SG-ORC-01"],
                ["city", "City", "Singapore"],
                ["region", "Region", "Central"],
                ["manager_name", "Manager", "Jane Tan"],
                ["timezone", "Time zone", "Asia/Singapore"],
              ] as const
            ).map(([key, label, ph]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`new-${key}`}>{label}</Label>
                <Input
                  id={`new-${key}`}
                  value={newForm[key]}
                  placeholder={ph}
                  maxLength={120}
                  onChange={(e) => setNewForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="bg-surface"
                />
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                Add outlet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
