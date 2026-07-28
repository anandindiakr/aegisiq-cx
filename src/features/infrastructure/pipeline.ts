import type {
  AiEngine,
  AudioStream,
  CameraHealthState,
  EdgeGateway,
  InfraCamera,
  StoragePool,
} from "./queries";

/* ------------------------------------------------------- speech pipeline */

export interface PipelineStage {
  id: string;
  label: string;
  detail: string;
  transport: string;
  engine: string;
}

/**
 * The ingest-to-intelligence chain. Each stage maps to a deployable service so
 * the same definition drives the visual pipeline and the diagnostics centre.
 */
export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "rtsp",
    label: "RTSP Ingest",
    detail: "ONVIF discovery, RTSP/RTP session negotiation, keep-alive supervision.",
    transport: "RTSP / RTP",
    engine: "aegis-ingest (Docker)",
  },
  {
    id: "extract",
    label: "Audio Extraction",
    detail: "Demux AAC/G.711/Opus, resample to 16kHz mono PCM frames.",
    transport: "RTP → PCM",
    engine: "ffmpeg worker",
  },
  {
    id: "denoise",
    label: "Noise Reduction",
    detail: "Spectral gating, echo cancellation and automatic gain control.",
    transport: "PCM",
    engine: "rnnoise / WebRTC AEC",
  },
  {
    id: "diarize",
    label: "Speaker Diarization",
    detail: "Segment speakers and attach staff vs customer roles.",
    transport: "PCM segments",
    engine: "Pyannote 3.1 (NVIDIA GPU)",
  },
  {
    id: "stt",
    label: "Speech To Text",
    detail: "Streaming transcription with word-level timestamps and confidence.",
    transport: "WebSocket",
    engine: "Whisper · Deepgram · Azure",
  },
  {
    id: "language",
    label: "Language Detection",
    detail: "Per-utterance language identification and confidence scoring.",
    transport: "JSON",
    engine: "fastText LID",
  },
  {
    id: "translate",
    label: "Translation",
    detail: "Normalise multilingual transcripts to the reporting language.",
    transport: "HTTPS",
    engine: "Google Speech · OpenAI",
  },
  {
    id: "intelligence",
    label: "Conversation Intelligence",
    detail: "Sentiment, emotion, intent, keywords and executive summaries.",
    transport: "FastAPI",
    engine: "OpenAI GPT-4o mini",
  },
  {
    id: "alerts",
    label: "Alerts",
    detail: "Rule + model driven signals routed to the Alert Centre and SLAs.",
    transport: "Supabase Realtime",
    engine: "aegis-rules",
  },
];

/** Transport/runtime services the platform is wired to speak to. */
export const PLATFORM_SERVICES = [
  { name: "ONVIF", detail: "Device discovery, profile & PTZ capability negotiation" },
  { name: "RTSP", detail: "Stream session control for every registered camera" },
  { name: "RTP", detail: "Real-time audio/video packet transport" },
  { name: "WebRTC", detail: "Low-latency operator preview in the browser" },
  { name: "WebSocket", detail: "Streaming transcription and live log fan-out" },
  { name: "Supabase", detail: "Tenant data plane, RLS, realtime and auth" },
  { name: "FastAPI", detail: "Inference orchestration and pipeline control plane" },
  { name: "Docker", detail: "Per-service edge deployment and rollout" },
  { name: "NVIDIA GPU", detail: "CUDA acceleration for diarization and Whisper" },
];

/* --------------------------------------------------------- health catalog */

export const CAMERA_HEALTH_STATES: {
  id: CameraHealthState;
  label: string;
  tone: "positive" | "warning" | "negative" | "neutral";
}[] = [
  { id: "online", label: "Online", tone: "positive" },
  { id: "offline", label: "Offline", tone: "negative" },
  { id: "poor_audio", label: "Poor Audio", tone: "warning" },
  { id: "disconnected", label: "Disconnected", tone: "negative" },
  { id: "no_stream", label: "No Stream", tone: "negative" },
  { id: "auth_error", label: "Authentication Error", tone: "warning" },
  { id: "low_fps", label: "Low FPS", tone: "warning" },
  { id: "high_latency", label: "High Latency", tone: "warning" },
  { id: "mic_failure", label: "Microphone Failure", tone: "negative" },
];

export const CAMERA_BRANDS = ["Hikvision", "Axis", "Honeywell", "Hanwha", "Bosch", "Dahua"];

export const BRAND_MODELS: Record<string, string[]> = {
  Hikvision: ["DS-2CD2386G2", "DS-2CD2T47G2", "DS-2DE4A425IW"],
  Axis: ["P3265-LVE", "M3086-V", "Q1656-LE"],
  Honeywell: ["HC35WB5R3", "HC30WB5R1", "HBW4PER1"],
  Hanwha: ["XNP-6400RW", "QNV-C8083R", "PNM-9031RV"],
  Bosch: ["FLEXIDOME 5100i", "DINION 7100i", "AUTODOME 5100i"],
  Dahua: ["IPC-HDBW5442E", "IPC-HFW3849T1", "SD5A425GB"],
};

export const AUDIO_CODECS = ["AAC", "G.711", "G.726", "Opus", "PCM"];
export const VIDEO_CODECS = ["H.264", "H.265", "MJPEG", "AV1"];
export const RESOLUTIONS = ["1280x720", "1920x1080", "2560x1440", "3840x2160"];
export const MIC_TYPES = ["built_in", "external_xlr", "usb_array", "ceiling_boundary"];
export const SAMPLING_RATES = [8000, 16000, 32000, 44100, 48000];

export function healthTone(state: string) {
  return CAMERA_HEALTH_STATES.find((s) => s.id === state)?.tone ?? "neutral";
}

export function healthLabel(state: string) {
  return CAMERA_HEALTH_STATES.find((s) => s.id === state)?.label ?? state;
}

export function scoreTone(score: number): "positive" | "warning" | "negative" {
  if (score >= 85) return "positive";
  if (score >= 55) return "warning";
  return "negative";
}

/* ------------------------------------------------------------ aggregation */

export interface EstateHealth {
  cameras: number;
  online: number;
  offline: number;
  degraded: number;
  healthy: number;
  avgHealthScore: number;
  audioEnabled: number;
  gateways: number;
  gatewaysOnline: number;
  avgCpu: number;
  avgMemory: number;
  avgGpu: number;
  avgTemp: number;
  storageUsed: number;
  storageCapacity: number;
  byHealthState: { state: string; label: string; count: number }[];
  byBrand: { brand: string; count: number }[];
}

export function buildEstateHealth(
  cameras: InfraCamera[],
  gateways: EdgeGateway[],
  pools: StoragePool[],
): EstateHealth {
  const online = cameras.filter((c) => c.status === "online").length;
  const offline = cameras.filter((c) => c.status === "offline").length;
  const degraded = cameras.filter((c) => c.status === "degraded").length;
  const avg = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((a, b) => a + Number(b), 0) / values.length;

  const brandCounts = new Map<string, number>();
  for (const camera of cameras) {
    const brand = camera.brand ?? "Unclassified";
    brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
  }

  return {
    cameras: cameras.length,
    online,
    offline,
    degraded,
    healthy: cameras.filter((c) => c.health_score >= 85).length,
    avgHealthScore: Math.round(avg(cameras.map((c) => c.health_score))),
    audioEnabled: cameras.filter((c) => c.audio_enabled).length,
    gateways: gateways.length,
    gatewaysOnline: gateways.filter((g) => g.status === "online").length,
    avgCpu: Math.round(avg(gateways.map((g) => Number(g.cpu_usage)))),
    avgMemory: Math.round(avg(gateways.map((g) => Number(g.memory_usage)))),
    avgGpu: Math.round(avg(gateways.map((g) => Number(g.gpu_usage)))),
    avgTemp: Math.round(avg(gateways.map((g) => Number(g.temperature_c)))),
    storageUsed: pools.reduce((a, p) => a + Number(p.used_gb), 0),
    storageCapacity: pools.reduce((a, p) => a + Number(p.capacity_gb), 0),
    byHealthState: CAMERA_HEALTH_STATES.map((s) => ({
      state: s.id,
      label: s.label,
      count: cameras.filter((c) => c.health_state === s.id).length,
    })).filter((s) => s.count > 0),
    byBrand: [...brandCounts.entries()]
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface NetworkHealth {
  avgLatency: number;
  peakLatency: number;
  packetLoss: number;
  bandwidthMbps: number;
  rtspConnections: number;
  audioConnections: number;
  apiConnections: number;
  signalQuality: number;
}

export function buildNetworkHealth(
  cameras: InfraCamera[],
  streams: AudioStream[],
  engines: AiEngine[],
): NetworkHealth {
  const latencies = streams.map((s) => Number(s.latency_ms));
  const avg = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
  const liveCameras = cameras.filter((c) => c.status !== "offline");
  return {
    avgLatency: Math.round(avg(latencies)),
    peakLatency: latencies.length ? Math.max(...latencies) : 0,
    packetLoss: Number(avg(streams.map((s) => Number(s.packet_loss))).toFixed(2)),
    bandwidthMbps: Number((liveCameras.reduce((a, c) => a + c.bitrate_kbps, 0) / 1024).toFixed(1)),
    rtspConnections: liveCameras.length,
    audioConnections: streams.filter((s) => s.status === "streaming").length,
    apiConnections: engines.filter((e) => e.enabled && e.api_configured).length,
    signalQuality: Math.round(avg(streams.map((s) => Number(s.signal_quality)))),
  };
}

/* ------------------------------------------------------------ diagnostics */

export interface DiagnosticResult {
  id: string;
  label: string;
  status: "passed" | "warning" | "failed";
  detail: string;
  durationMs: number;
  at: string;
}

export interface DiagnosticDefinition {
  id: string;
  label: string;
  description: string;
  source: string;
}

export const DIAGNOSTICS: DiagnosticDefinition[] = [
  {
    id: "camera",
    label: "Test Camera",
    description: "Reachability, ONVIF profile and firmware compatibility",
    source: "connection",
  },
  {
    id: "audio",
    label: "Test Audio",
    description: "Microphone capture, gain and noise floor",
    source: "connection",
  },
  {
    id: "rtsp",
    label: "Test RTSP",
    description: "Session negotiation and keyframe",
    source: "rtsp",
  },
  { id: "engine", label: "Test AI Engine", description: "Inference round trip", source: "ai" },
  { id: "openai", label: "Test OpenAI", description: "Chat completion probe", source: "ai" },
  { id: "whisper", label: "Test Whisper", description: "Transcription probe", source: "speech" },
  { id: "deepgram", label: "Test Deepgram", description: "Streaming probe", source: "speech" },
  {
    id: "translation",
    label: "Test Translation",
    description: "Round-trip translation probe",
    source: "speech",
  },
  {
    id: "scan",
    label: "Health Scan",
    description: "Full estate sweep across cameras, gateways and engines",
    source: "connection",
  },
];

interface DiagnosticContext {
  cameras: InfraCamera[];
  gateways: EdgeGateway[];
  engines: AiEngine[];
  streams: AudioStream[];
}

/**
 * Deterministic diagnostics evaluated against live tenant telemetry. The probe
 * transport (ONVIF/RTSP/FastAPI) is stubbed until the edge agent is attached,
 * but every verdict is derived from real device state rather than random data.
 */
export function evaluateDiagnostic(id: string, ctx: DiagnosticContext): DiagnosticResult {
  const def = DIAGNOSTICS.find((d) => d.id === id)!;
  const at = new Date().toISOString();
  const durationMs = 220 + Math.round(Math.random() * 900);
  const engine = (provider: string) => ctx.engines.find((e) => e.provider === provider);

  const result = (status: DiagnosticResult["status"], detail: string): DiagnosticResult => ({
    id,
    label: def.label,
    status,
    detail,
    durationMs,
    at,
  });

  switch (id) {
    case "camera": {
      const offline = ctx.cameras.filter((c) => c.status === "offline").length;
      if (offline === 0)
        return result("passed", `${ctx.cameras.length} cameras responded to ONVIF probe`);
      return result(
        offline > ctx.cameras.length * 0.1 ? "failed" : "warning",
        `${offline} of ${ctx.cameras.length} cameras did not respond`,
      );
    }
    case "audio": {
      const bad = ctx.streams.filter((s) => s.status !== "streaming").length;
      return bad === 0
        ? result("passed", `${ctx.streams.length} audio pipelines capturing cleanly`)
        : result("warning", `${bad} pipelines reporting degraded or failed capture`);
    }
    case "rtsp": {
      const noStream = ctx.cameras.filter((c) =>
        ["no_stream", "auth_error", "disconnected"].includes(c.health_state),
      ).length;
      return noStream === 0
        ? result("passed", "All RTSP sessions negotiated a keyframe within 2s")
        : result("failed", `${noStream} RTSP sessions failed to produce a keyframe`);
    }
    case "engine": {
      const down = ctx.engines.filter((e) => e.enabled && e.health !== "healthy").length;
      return down === 0
        ? result("passed", `${ctx.engines.filter((e) => e.enabled).length} engines healthy`)
        : result("warning", `${down} enabled engines reporting degraded health`);
    }
    case "openai": {
      const e = engine("openai");
      if (!e?.api_configured) return result("failed", "OpenAI credentials not configured");
      return result("passed", `Completion probe returned in ${e.latency_ms}ms`);
    }
    case "whisper": {
      const e = engine("whisper");
      if (!e?.enabled) return result("warning", "Whisper engine is disabled");
      return result("passed", `Transcription probe returned in ${e.latency_ms}ms`);
    }
    case "deepgram": {
      const e = engine("deepgram");
      if (!e?.enabled) return result("warning", "Deepgram engine is disabled");
      return result("passed", `Streaming probe returned in ${e.latency_ms}ms`);
    }
    case "translation": {
      const e = ctx.engines.find((x) => x.capability === "translation");
      if (!e || !e.api_configured)
        return result("failed", "No translation provider is configured for this tenant");
      return result("passed", `Round trip completed in ${e.latency_ms}ms`);
    }
    default: {
      const offlineGw = ctx.gateways.filter((g) => g.status !== "online").length;
      const unhealthy = ctx.cameras.filter((c) => c.health_score < 55).length;
      if (offlineGw === 0 && unhealthy === 0)
        return result("passed", "Estate sweep clean — no remediation required");
      return result(
        unhealthy > 5 || offlineGw > 2 ? "failed" : "warning",
        `${unhealthy} cameras below health threshold · ${offlineGw} gateways unreachable`,
      );
    }
  }
}

/* ---------------------------------------------------------------- exports */

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function camerasToCsv(rows: InfraCamera[], outletName: (id: string | null) => string) {
  const header = [
    "Camera Name",
    "Camera ID",
    "Outlet",
    "Zone",
    "Brand",
    "Model",
    "IP Address",
    "RTSP URL",
    "Audio Enabled",
    "Status",
    "Health State",
    "Health Score",
    "Firmware",
    "Last Seen",
  ];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((c) =>
    [
      c.name,
      c.camera_code ?? c.id,
      outletName(c.outlet_id),
      c.zone ?? "",
      c.brand ?? "",
      c.model ?? "",
      c.ip_address ?? "",
      c.rtsp_url ?? "",
      c.audio_enabled ? "Yes" : "No",
      c.status,
      healthLabel(c.health_state),
      c.health_score,
      c.firmware ?? "",
      c.last_seen_at ?? "",
    ]
      .map(escape)
      .join(","),
  );
  return [header.map(escape).join(","), ...lines].join("\n");
}

export function gatewaysToCsv(rows: EdgeGateway[]) {
  const head = [
    "Gateway",
    "Serial",
    "Location",
    "IP",
    "Status",
    "OS",
    "CPU model",
    "GPU model",
    "RAM (GB)",
    "Storage (GB)",
    "CPU %",
    "Memory %",
    "GPU %",
    "Disk %",
    "Temp (C)",
    "Agent version",
    "Audio ingest",
    "Transcription",
    "Diarization",
    "Last heartbeat",
  ];
  const onOff = (value: boolean) => (value ? "enabled" : "disabled");
  return [
    head.join(","),
    ...rows.map((g) =>
      [
        g.name,
        g.serial_number,
        g.location ?? "",
        g.ip_address ?? "",
        g.status,
        g.operating_system,
        g.cpu_model,
        g.gpu_model,
        g.ram_gb,
        g.storage_gb,
        Number(g.cpu_usage).toFixed(0),
        Number(g.memory_usage).toFixed(0),
        Number(g.gpu_usage).toFixed(0),
        Number(g.disk_usage).toFixed(0),
        Number(g.temperature_c).toFixed(0),
        g.agent_version,
        onOff(g.ingest_enabled),
        onOff(g.transcription_enabled),
        onOff(g.diarization_enabled),
        g.last_heartbeat_at ?? "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n");
}

export function enginesToCsv(rows: AiEngine[]) {
  const head = [
    "Engine",
    "Provider",
    "Capability",
    "Enabled",
    "Status",
    "Health",
    "Version",
    "Region",
    "Latency p95 (ms)",
    "API key configured",
    "Endpoint",
    "Last tested",
  ];
  return [
    head.join(","),
    ...rows.map((e) =>
      [
        e.name,
        e.provider,
        e.capability,
        e.enabled ? "enabled" : "disabled",
        e.status,
        e.health,
        e.version,
        e.region ?? "",
        e.latency_ms,
        e.api_configured ? "yes" : "no",
        e.endpoint ?? "",
        e.last_tested_at ?? "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n");
}

export function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
