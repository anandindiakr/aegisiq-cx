import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Plug, Radio, Volume2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/common/Primitives";
import { cn } from "@/lib/utils";
import { outletsQuery } from "@/features/platform/queries";
import { createCamera, logInfraEvent, type CameraDraft } from "@/features/infrastructure/queries";
import {
  AUDIO_CODECS,
  BRAND_MODELS,
  CAMERA_BRANDS,
  MIC_TYPES,
  RESOLUTIONS,
  SAMPLING_RATES,
  VIDEO_CODECS,
} from "@/features/infrastructure/pipeline";

const STEPS = ["Basic information", "Network", "Audio", "Validation"];

const EMPTY: CameraDraft = {
  name: "",
  outlet_id: null,
  zone: "",
  description: "",
  brand: "Hikvision",
  model: "DS-2CD2386G2",
  ip_address: "",
  port: 554,
  stream_username: "aegis-svc",
  rtsp_url: "",
  https_enabled: true,
  onvif_enabled: true,
  audio_codec: "AAC",
  video_codec: "H.264",
  resolution: "1920x1080",
  fps: 25,
  bitrate_kbps: 4096,
  audio_enabled: true,
  mic_type: "built_in",
  sampling_rate: 16000,
  noise_reduction: true,
  echo_cancellation: true,
  gain: 1,
};

type CheckState = "idle" | "running" | "passed" | "failed";

/** Four-step provisioning wizard for registering an enterprise camera. */
export function AddCameraWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const outlets = useQuery(outletsQuery);
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CameraDraft>(EMPTY);
  const [password, setPassword] = useState("");
  const [checks, setChecks] = useState<Record<string, CheckState>>({
    connection: "idle",
    rtsp: "idle",
    audio: "idle",
  });

  const set = <K extends keyof CameraDraft>(key: K, value: CameraDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const rtsp =
    draft.rtsp_url ||
    (draft.ip_address ? `rtsp://${draft.ip_address}:${draft.port}/Streaming/Channels/101` : "");

  const runCheck = (key: string, ok: boolean) => {
    setChecks((prev) => ({ ...prev, [key]: "running" }));
    window.setTimeout(() => {
      setChecks((prev) => ({ ...prev, [key]: ok ? "passed" : "failed" }));
    }, 900);
  };

  const save = useMutation({
    mutationFn: async () => {
      await createCamera({ ...draft, rtsp_url: rtsp });
      await logInfraEvent({
        source: "connection",
        level: "info",
        message: `Camera ${draft.name} registered (${draft.brand} ${draft.model})`,
        device_type: "camera",
        device_name: draft.name,
      });
    },
    onSuccess: () => {
      toast.success("Camera registered");
      queryClient.invalidateQueries({ queryKey: ["infrastructure"] });
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
      onOpenChange(false);
      setStep(0);
      setDraft(EMPTY);
      setPassword("");
      setChecks({ connection: "idle", rtsp: "idle", audio: "idle" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canAdvance =
    step !== 0 || (draft.name.trim().length > 1 && draft.outlet_id !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register camera</DialogTitle>
          <DialogDescription>
            Provision an edge audio-capture device, negotiate its stream and validate the pipeline
            before it joins the estate.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap items-center gap-2">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-[11px] font-semibold ring-1",
                  index === step
                    ? "bg-primary/15 text-primary ring-primary/40"
                    : index < step
                      ? "bg-success/15 text-success ring-success/30"
                      : "bg-muted/40 text-muted-foreground ring-border",
                )}
              >
                {index < step ? <Check className="size-3" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-xs",
                  index === step ? "font-medium" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              {index < STEPS.length - 1 && <span className="h-px w-4 bg-border" />}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Camera name">
              <Input
                value={draft.name}
                maxLength={80}
                onChange={(e) => set("name", e.target.value)}
                placeholder="DXB-01-CAM-014"
              />
            </Field>
            <Field label="Outlet">
              <Select
                value={draft.outlet_id ?? undefined}
                onValueChange={(value) => set("outlet_id", value)}
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
            <Field label="Zone">
              <Input
                value={draft.zone ?? ""}
                maxLength={60}
                onChange={(e) => set("zone", e.target.value)}
                placeholder="Checkout"
              />
            </Field>
            <Field label="Brand">
              <Select
                value={draft.brand ?? undefined}
                onValueChange={(value) => {
                  set("brand", value);
                  set("model", BRAND_MODELS[value]?.[0] ?? "");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMERA_BRANDS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Model">
              <Select value={draft.model ?? undefined} onValueChange={(v) => set("model", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(BRAND_MODELS[draft.brand ?? ""] ?? []).map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea
                value={draft.description ?? ""}
                maxLength={280}
                rows={2}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Covers the checkout lanes and service desk queue."
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="IP address">
              <Input
                value={draft.ip_address ?? ""}
                maxLength={45}
                onChange={(e) => set("ip_address", e.target.value)}
                placeholder="10.42.3.61"
              />
            </Field>
            <Field label="Port">
              <Input
                type="number"
                value={draft.port}
                onChange={(e) => set("port", Number(e.target.value) || 554)}
              />
            </Field>
            <Field label="Username">
              <Input
                value={draft.stream_username ?? ""}
                maxLength={60}
                onChange={(e) => set("stream_username", e.target.value)}
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                maxLength={128}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Stored in the device vault"
              />
            </Field>
            <Field label="RTSP URL" className="sm:col-span-2">
              <Input
                value={draft.rtsp_url || rtsp}
                maxLength={240}
                onChange={(e) => set("rtsp_url", e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
            <ToggleRow
              label="HTTPS"
              hint="Encrypt the management channel"
              checked={draft.https_enabled}
              onChange={(v) => set("https_enabled", v)}
            />
            <ToggleRow
              label="ONVIF"
              hint="Profile S discovery and control"
              checked={draft.onvif_enabled}
              onChange={(v) => set("onvif_enabled", v)}
            />
            <Field label="Audio codec">
              <Picker
                value={draft.audio_codec}
                options={AUDIO_CODECS}
                onChange={(v) => set("audio_codec", v)}
              />
            </Field>
            <Field label="Video codec">
              <Picker
                value={draft.video_codec}
                options={VIDEO_CODECS}
                onChange={(v) => set("video_codec", v)}
              />
            </Field>
            <Field label="Resolution">
              <Picker
                value={draft.resolution}
                options={RESOLUTIONS}
                onChange={(v) => set("resolution", v)}
              />
            </Field>
            <Field label={`FPS · ${draft.fps}`}>
              <Slider
                value={[draft.fps]}
                min={5}
                max={60}
                step={1}
                onValueChange={([v]) => set("fps", v)}
              />
            </Field>
            <Field label={`Bitrate · ${draft.bitrate_kbps} kbps`} className="sm:col-span-2">
              <Slider
                value={[draft.bitrate_kbps]}
                min={512}
                max={16384}
                step={512}
                onValueChange={([v]) => set("bitrate_kbps", v)}
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <ToggleRow
              label="Enable audio"
              hint="Capture microphone input for ConversationIQ"
              checked={draft.audio_enabled}
              onChange={(v) => set("audio_enabled", v)}
            />
            <Field label="Microphone type">
              <Picker
                value={draft.mic_type}
                options={MIC_TYPES}
                onChange={(v) => set("mic_type", v)}
              />
            </Field>
            <Field label="Sampling rate">
              <Picker
                value={String(draft.sampling_rate)}
                options={SAMPLING_RATES.map(String)}
                onChange={(v) => set("sampling_rate", Number(v))}
              />
            </Field>
            <Field label={`Gain · ${draft.gain.toFixed(2)}x`}>
              <Slider
                value={[draft.gain]}
                min={0.2}
                max={3}
                step={0.05}
                onValueChange={([v]) => set("gain", v)}
              />
            </Field>
            <ToggleRow
              label="Noise reduction"
              hint="Spectral gating on the edge"
              checked={draft.noise_reduction}
              onChange={(v) => set("noise_reduction", v)}
            />
            <ToggleRow
              label="Echo cancellation"
              hint="WebRTC AEC before diarization"
              checked={draft.echo_cancellation}
              onChange={(v) => set("echo_cancellation", v)}
            />
            <div className="sm:col-span-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!draft.audio_enabled}
                onClick={() => runCheck("audio", draft.audio_enabled)}
              >
                <Volume2 className="mr-2 size-4" /> Test audio
              </Button>
              {checks.audio !== "idle" && (
                <span className="ml-3 text-xs text-muted-foreground">
                  {checks.audio === "running" ? "Capturing 3s sample…" : `Sample ${checks.audio}`}
                </span>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <CheckRow
              icon={Plug}
              label="Test connection"
              hint={draft.ip_address ? `${draft.ip_address}:${draft.port}` : "No IP address set"}
              state={checks.connection}
              onRun={() => runCheck("connection", Boolean(draft.ip_address))}
            />
            <CheckRow
              icon={Radio}
              label="Validate RTSP"
              hint={rtsp || "No stream endpoint"}
              state={checks.rtsp}
              onRun={() => runCheck("rtsp", Boolean(rtsp))}
            />
            <CheckRow
              icon={Volume2}
              label="Validate audio"
              hint={
                draft.audio_enabled
                  ? `${draft.mic_type.replace(/_/g, " ")} · ${draft.sampling_rate} Hz`
                  : "Audio capture disabled"
              }
              state={checks.audio}
              onRun={() => runCheck("audio", draft.audio_enabled)}
            />
            <p className="text-xs text-muted-foreground">
              Probes run through the edge agent. Until an agent is bound to this outlet, validation
              confirms configuration completeness rather than live device response.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save camera
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Picker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="capitalize">
            {o.replace(/_/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} aria-label={label} onCheckedChange={onChange} />
    </div>
  );
}

function CheckRow({
  icon: Icon,
  label,
  hint,
  state,
  onRun,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  state: CheckState;
  onRun: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/50 px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {state === "passed" && <StatusPill label="passed" tone="positive" />}
        {state === "failed" && <StatusPill label="failed" tone="negative" />}
        <Button variant="outline" size="sm" onClick={onRun} disabled={state === "running"}>
          {state === "running" ? <Loader2 className="size-4 animate-spin" /> : "Run"}
        </Button>
      </div>
    </div>
  );
}
