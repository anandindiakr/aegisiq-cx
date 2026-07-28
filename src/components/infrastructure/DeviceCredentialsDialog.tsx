import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, KeyRound, Loader2, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

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
import { StatusPill } from "@/components/common/Primitives";
import { formatRelative } from "@/lib/format";
import {
  deviceCredentialsQuery,
  revealDeviceCredential,
  saveDeviceCredential,
  useCredentialAccess,
  type RevealedCredential,
} from "@/features/infrastructure/audit";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  deviceType: "camera" | "gateway";
  deviceId: string | null;
  deviceName: string;
  defaultRtspUrl?: string | null;
}

const EMPTY = {
  username: "",
  secret: "",
  onvifUsername: "",
  onvifSecret: "",
  rtspUrl: "",
};

/**
 * Encrypted credential vault for one device.
 *
 * Secrets are written through a database function that encrypts them with
 * pgcrypto; nothing here ever reads a plaintext column. Only workspace admins
 * can store or reveal, and each reveal is appended to the change history.
 */
export function DeviceCredentialsDialog({
  open,
  onOpenChange,
  deviceType,
  deviceId,
  deviceName,
  defaultRtspUrl,
}: Props) {
  const access = useCredentialAccess();
  const queryClient = useQueryClient();
  const credentials = useQuery({ ...deviceCredentialsQuery(deviceType), enabled: open });
  const record = (credentials.data ?? []).find((c) => c.device_id === deviceId) ?? null;

  const [draft, setDraft] = useState(EMPTY);
  const [revealed, setRevealed] = useState<RevealedCredential | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft(EMPTY);
      setRevealed(null);
      return;
    }
    setDraft({
      username: record?.username ?? "",
      secret: "",
      onvifUsername: record?.onvif_username ?? "",
      onvifSecret: "",
      rtspUrl: record?.rtsp_url ?? defaultRtspUrl ?? "",
    });
  }, [open, record, defaultRtspUrl]);

  const set = (key: keyof typeof EMPTY, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      if (!deviceId) throw new Error("No device selected.");
      await saveDeviceCredential({
        deviceType,
        deviceId,
        username: draft.username,
        secret: draft.secret,
        onvifUsername: draft.onvifUsername,
        onvifSecret: draft.onvifSecret,
        rtspUrl: draft.rtspUrl,
      });
    },
    onSuccess: () => {
      toast.success("Credentials stored encrypted");
      queryClient.invalidateQueries({ queryKey: ["infrastructure"] });
      setRevealed(null);
      setDraft((prev) => ({ ...prev, secret: "", onvifSecret: "" }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reveal = useMutation({
    mutationFn: async () => {
      if (!record) throw new Error("No credentials stored for this device yet.");
      return revealDeviceCredential(record.id);
    },
    onSuccess: (value) => {
      setRevealed(value);
      queryClient.invalidateQueries({ queryKey: ["infrastructure", "audit"] });
      toast.info("Reveal recorded in the change history");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" /> Credentials · {deviceName}
          </DialogTitle>
          <DialogDescription>
            Stream and ONVIF secrets are encrypted at rest. Only workspace admins can save or
            reveal them, and every access is written to the change history.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2.5 text-xs">
          <Lock className="size-3.5 text-primary" />
          {record ? (
            <>
              <StatusPill label="stored" tone="positive" />
              <span className="text-muted-foreground">
                Rotated {formatRelative(record.rotated_at)}
                {record.last_revealed_at
                  ? ` · last revealed ${formatRelative(record.last_revealed_at)}`
                  : ""}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">No credentials on file for this device.</span>
          )}
        </div>

        {!access.canManage ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-3 text-xs">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              Your role can see that credentials exist but cannot view or change them. Ask a
              workspace admin to rotate the secret for this device.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Stream username">
                <Input
                  value={draft.username}
                  maxLength={64}
                  autoComplete="off"
                  onChange={(event) => set("username", event.target.value)}
                  placeholder="svc-aegis"
                />
              </Field>
              <Field label={record ? "New stream password" : "Stream password"}>
                <Input
                  type="password"
                  value={draft.secret}
                  maxLength={128}
                  autoComplete="new-password"
                  onChange={(event) => set("secret", event.target.value)}
                  placeholder={record ? "Leave blank to keep current" : "••••••••"}
                />
              </Field>
              <Field label="ONVIF username">
                <Input
                  value={draft.onvifUsername}
                  maxLength={64}
                  autoComplete="off"
                  onChange={(event) => set("onvifUsername", event.target.value)}
                />
              </Field>
              <Field label={record ? "New ONVIF password" : "ONVIF password"}>
                <Input
                  type="password"
                  value={draft.onvifSecret}
                  maxLength={128}
                  autoComplete="new-password"
                  onChange={(event) => set("onvifSecret", event.target.value)}
                  placeholder={record ? "Leave blank to keep current" : "••••••••"}
                />
              </Field>
            </div>
            <Field label="RTSP endpoint">
              <Input
                value={draft.rtspUrl}
                maxLength={300}
                onChange={(event) => set("rtspUrl", event.target.value)}
                placeholder="rtsp://10.42.4.20:554/Streaming/Channels/101"
              />
            </Field>

            {revealed && (
              <div className="grid gap-1 rounded-lg border border-border bg-background/60 p-3 font-mono text-[11px]">
                <Row label="username" value={revealed.username} />
                <Row label="password" value={revealed.secret} />
                <Row label="onvif user" value={revealed.onvif_username} />
                <Row label="onvif password" value={revealed.onvif_secret} />
                <Row label="rtsp" value={revealed.rtsp_url} />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {access.canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={!record || reveal.isPending}
                onClick={() => reveal.mutate()}
              >
                {reveal.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Eye className="mr-2 size-4" />
                )}
                Reveal
              </Button>
              <Button
                size="sm"
                disabled={save.isPending || !deviceId}
                onClick={() => save.mutate()}
              >
                {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save encrypted
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate">{value ?? "—"}</span>
    </div>
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
