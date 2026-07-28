import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import { traced } from "@/lib/observability";

// The generated database types lag behind the infrastructure migrations, so
// this module talks to the backend through a narrow untyped surface. Every
// query is still tenant-scoped client-side (defence in depth) on top of RLS.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as { from: (table: string) => AnyBuilder };

function tenant(): string {
  const id = getActiveTenant();
  if (!id) throw new Error("No active workspace resolved yet.");
  return id;
}

async function run<T>(
  builder: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  operation = "supabase.infrastructure",
) {
  return traced(operation, async () => {
    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    return (data ?? []) as T;
  });
}

/* ------------------------------------------------------------------ types */

export type CameraStatus = "online" | "offline" | "degraded" | "maintenance";

export type CameraHealthState =
  | "online"
  | "offline"
  | "poor_audio"
  | "disconnected"
  | "no_stream"
  | "auth_error"
  | "low_fps"
  | "high_latency"
  | "mic_failure";

export interface InfraCamera {
  id: string;
  outlet_id: string | null;
  gateway_id: string | null;
  name: string;
  camera_code: string | null;
  zone: string | null;
  brand: string | null;
  model: string | null;
  description: string | null;
  location: string | null;
  ip_address: string | null;
  port: number;
  stream_username: string | null;
  rtsp_url: string | null;
  https_enabled: boolean;
  onvif_enabled: boolean;
  audio_codec: string;
  video_codec: string;
  resolution: string;
  fps: number;
  bitrate_kbps: number;
  audio_enabled: boolean;
  mic_type: string;
  sampling_rate: number;
  noise_reduction: boolean;
  echo_cancellation: boolean;
  gain: number;
  status: CameraStatus;
  health_state: CameraHealthState;
  health_score: number;
  firmware: string | null;
  last_seen_at: string | null;
}

export interface EdgeGateway {
  id: string;
  name: string;
  serial_number: string;
  operating_system: string;
  cpu_model: string;
  gpu_model: string;
  ram_gb: number;
  storage_gb: number;
  ip_address: string | null;
  location: string | null;
  outlet_ids: string[];
  status: string;
  cpu_usage: number;
  memory_usage: number;
  gpu_usage: number;
  disk_usage: number;
  temperature_c: number;
  agent_version: string;
  last_heartbeat_at: string | null;
  notes: string | null;
}

export interface AiEngine {
  id: string;
  provider: string;
  name: string;
  capability: string;
  enabled: boolean;
  status: string;
  api_configured: boolean;
  version: string;
  health: string;
  latency_ms: number;
  endpoint: string | null;
  region: string | null;
  notes: string | null;
  last_tested_at: string | null;
}

export interface AudioStream {
  id: string;
  camera_id: string;
  sampling_rate: number;
  channels: number;
  codec: string;
  bitrate_kbps: number;
  noise_floor_db: number;
  latency_ms: number;
  packet_loss: number;
  signal_quality: number;
  status: string;
}

export interface StoragePool {
  id: string;
  name: string;
  kind: string;
  tier: string;
  used_gb: number;
  capacity_gb: number;
  retention_days: number;
  archive_enabled: boolean;
  archive_target: string | null;
}

export interface InfraEvent {
  id: string;
  source: string;
  level: string;
  device_type: string | null;
  device_id: string | null;
  device_name: string | null;
  message: string;
  created_at: string;
}

const CAMERA_COLUMNS =
  "id,outlet_id,gateway_id,name,camera_code,zone,brand,model,description,location,ip_address,port,stream_username,rtsp_url,https_enabled,onvif_enabled,audio_codec,video_codec,resolution,fps,bitrate_kbps,audio_enabled,mic_type,sampling_rate,noise_reduction,echo_cancellation,gain,status,health_state,health_score,firmware,last_seen_at";

/* ---------------------------------------------------------------- queries */

export const infraCamerasQuery = queryOptions({
  queryKey: ["infrastructure", "cameras"],
  queryFn: () =>
    run<InfraCamera[]>(
      raw
        .from("cameras")
        .select(CAMERA_COLUMNS)
        .eq("company_id", tenant())
        .is("deleted_at", null)
        .order("name")
        .limit(2000),
      "supabase.infra-cameras",
    ),
  staleTime: 20_000,
});

export const edgeGatewaysQuery = queryOptions({
  queryKey: ["infrastructure", "gateways"],
  queryFn: () =>
    run<EdgeGateway[]>(
      raw
        .from("edge_gateways")
        .select("*")
        .eq("company_id", tenant())
        .is("deleted_at", null)
        .order("name"),
      "supabase.edge-gateways",
    ),
  staleTime: 20_000,
});

export const aiEnginesQuery = queryOptions({
  queryKey: ["infrastructure", "ai-engines"],
  queryFn: () =>
    run<AiEngine[]>(
      raw.from("ai_engines").select("*").eq("company_id", tenant()).order("name"),
      "supabase.ai-engines",
    ),
  staleTime: 20_000,
});

export const audioStreamsQuery = queryOptions({
  queryKey: ["infrastructure", "audio-streams"],
  queryFn: () =>
    run<AudioStream[]>(
      raw.from("audio_streams").select("*").eq("company_id", tenant()).limit(2000),
      "supabase.audio-streams",
    ),
  staleTime: 20_000,
});

export const storagePoolsQuery = queryOptions({
  queryKey: ["infrastructure", "storage"],
  queryFn: () =>
    run<StoragePool[]>(
      raw.from("storage_pools").select("*").eq("company_id", tenant()).order("name"),
      "supabase.storage-pools",
    ),
  staleTime: 60_000,
});

export function infraEventsQuery(limit = 200) {
  return queryOptions({
    queryKey: ["infrastructure", "events", limit],
    queryFn: () =>
      run<InfraEvent[]>(
        raw
          .from("infra_events")
          .select("id,source,level,device_type,device_id,device_name,message,created_at")
          .eq("company_id", tenant())
          .order("created_at", { ascending: false })
          .limit(limit),
        "supabase.infra-events",
      ),
    staleTime: 5_000,
  });
}

/* -------------------------------------------------------------- mutations */

export interface CameraDraft {
  name: string;
  outlet_id: string | null;
  zone: string | null;
  description: string | null;
  brand: string | null;
  model: string | null;
  ip_address: string | null;
  port: number;
  stream_username: string | null;
  rtsp_url: string | null;
  https_enabled: boolean;
  onvif_enabled: boolean;
  audio_codec: string;
  video_codec: string;
  resolution: string;
  fps: number;
  bitrate_kbps: number;
  audio_enabled: boolean;
  mic_type: string;
  sampling_rate: number;
  noise_reduction: boolean;
  echo_cancellation: boolean;
  gain: number;
}

export async function createCamera(draft: CameraDraft) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await raw.from("cameras").insert({
    ...draft,
    company_id: tenant(),
    location: draft.zone,
    camera_code: `CAM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    status: "online",
    health_state: "online",
    health_score: 100,
    firmware: "v1.0.0",
    last_seen_at: new Date().toISOString(),
    created_by: auth.user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateInfraCamera(id: string, patch: Partial<InfraCamera>) {
  const { error } = await raw
    .from("cameras")
    .update(patch)
    .eq("company_id", tenant())
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function bulkUpdateCameras(ids: string[], patch: Partial<InfraCamera>) {
  if (ids.length === 0) return 0;
  const { error } = await raw
    .from("cameras")
    .update(patch)
    .eq("company_id", tenant())
    .in("id", ids);
  if (error) throw new Error(error.message);
  return ids.length;
}

export async function softDeleteCameras(ids: string[]) {
  if (ids.length === 0) return 0;
  const { error } = await raw
    .from("cameras")
    .update({ deleted_at: new Date().toISOString() })
    .eq("company_id", tenant())
    .in("id", ids);
  if (error) throw new Error(error.message);
  return ids.length;
}

export interface GatewayDraft {
  name: string;
  serial_number: string;
  operating_system: string;
  cpu_model: string;
  gpu_model: string;
  ram_gb: number;
  storage_gb: number;
  ip_address: string | null;
  location: string | null;
  outlet_ids: string[];
}

export async function createGateway(draft: GatewayDraft) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await raw.from("edge_gateways").insert({
    ...draft,
    company_id: tenant(),
    status: "online",
    agent_version: "2.5.3",
    last_heartbeat_at: new Date().toISOString(),
    created_by: auth.user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateGateway(id: string, patch: Partial<EdgeGateway>) {
  const { error } = await raw
    .from("edge_gateways")
    .update(patch)
    .eq("company_id", tenant())
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateEngine(id: string, patch: Partial<AiEngine>) {
  const { error } = await raw
    .from("ai_engines")
    .update(patch)
    .eq("company_id", tenant())
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateStoragePool(id: string, patch: Partial<StoragePool>) {
  const { error } = await raw
    .from("storage_pools")
    .update(patch)
    .eq("company_id", tenant())
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function logInfraEvent(event: {
  source: string;
  level: string;
  message: string;
  device_type?: string | null;
  device_id?: string | null;
  device_name?: string | null;
}) {
  const { error } = await raw.from("infra_events").insert({
    company_id: tenant(),
    source: event.source,
    level: event.level,
    message: event.message,
    device_type: event.device_type ?? null,
    device_id: event.device_id ?? null,
    device_name: event.device_name ?? null,
  });
  if (error) throw new Error(error.message);
}
