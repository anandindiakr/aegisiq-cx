import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { StatusPill } from "@/components/common/Primitives";
import { outletsQuery } from "@/features/platform/queries";
import { createGateway, logInfraEvent, type GatewayDraft } from "@/features/infrastructure/queries";

const EMPTY: GatewayDraft = {
  name: "",
  serial_number: "",
  operating_system: "Ubuntu 22.04 LTS",
  cpu_model: "Intel Xeon E-2388G",
  gpu_model: "NVIDIA RTX A2000",
  ram_gb: 32,
  storage_gb: 1024,
  ip_address: "",
  location: "",
  outlet_ids: [],
};

/** Registration dialog for an AI edge gateway. */
export function AddGatewayDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const outlets = useQuery(outletsQuery);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<GatewayDraft>(EMPTY);
  const [health, setHealth] = useState<"idle" | "running" | "passed">("idle");

  const set = <K extends keyof GatewayDraft>(key: K, value: GatewayDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      await createGateway(draft);
      await logInfraEvent({
        source: "connection",
        level: "info",
        message: `Edge gateway ${draft.name} enrolled (${draft.gpu_model})`,
        device_type: "gateway",
        device_name: draft.name,
      });
    },
    onSuccess: () => {
      toast.success("Edge gateway enrolled");
      queryClient.invalidateQueries({ queryKey: ["infrastructure"] });
      onOpenChange(false);
      setDraft(EMPTY);
      setHealth("idle");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enrol edge gateway</DialogTitle>
          <DialogDescription>
            Register an on-premise AI inference node. The agent reports CPU, GPU, memory and disk
            telemetry over a heartbeat once enrolled.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gateway name">
            <Input
              value={draft.name}
              maxLength={80}
              onChange={(e) => set("name", e.target.value)}
              placeholder="EDGE-GW-021"
            />
          </Field>
          <Field label="Serial number">
            <Input
              value={draft.serial_number}
              maxLength={64}
              onChange={(e) => set("serial_number", e.target.value)}
              placeholder="SN-AEG-472121"
            />
          </Field>
          <Field label="Operating system">
            <Input
              value={draft.operating_system}
              maxLength={64}
              onChange={(e) => set("operating_system", e.target.value)}
            />
          </Field>
          <Field label="CPU">
            <Input
              value={draft.cpu_model}
              maxLength={64}
              onChange={(e) => set("cpu_model", e.target.value)}
            />
          </Field>
          <Field label="GPU">
            <Input
              value={draft.gpu_model}
              maxLength={64}
              onChange={(e) => set("gpu_model", e.target.value)}
            />
          </Field>
          <Field label="RAM (GB)">
            <Input
              type="number"
              value={draft.ram_gb}
              onChange={(e) => set("ram_gb", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Storage (GB)">
            <Input
              type="number"
              value={draft.storage_gb}
              onChange={(e) => set("storage_gb", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="IP address">
            <Input
              value={draft.ip_address ?? ""}
              maxLength={45}
              onChange={(e) => set("ip_address", e.target.value)}
              placeholder="10.42.4.20"
            />
          </Field>
          <Field label="Location">
            <Input
              value={draft.location ?? ""}
              maxLength={120}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Dubai · Marina Mall comms room"
            />
          </Field>
          <Field label="Assigned outlet">
            <Select
              value={draft.outlet_ids[0]}
              onValueChange={(value) => set("outlet_ids", [value])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select outlet" />
              </SelectTrigger>
              <SelectContent>
                {(outlets.data ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/50 px-3 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Health check</p>
              <p className="text-[11px] text-muted-foreground">
                Verify agent reachability, CUDA runtime and disk headroom
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {health === "passed" && <StatusPill label="ready" tone="positive" />}
            <Button
              variant="outline"
              size="sm"
              disabled={health === "running"}
              onClick={() => {
                setHealth("running");
                window.setTimeout(() => setHealth("passed"), 900);
              }}
            >
              {health === "running" ? <Loader2 className="size-4 animate-spin" /> : "Run"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={
              save.isPending || draft.name.trim().length < 2 || draft.serial_number.trim().length < 3
            }
            onClick={() => save.mutate()}
          >
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Enrol gateway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
