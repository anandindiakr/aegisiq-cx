/**
 * Infrastructure governance: change history and encrypted device credentials.
 *
 * Change history is written by database triggers on `cameras`, `edge_gateways`
 * and `ai_engines`, so every edit — single, bulk or decommission — is recorded
 * with the actor, the fields touched and a before/after snapshot. Credentials
 * are encrypted at rest with pgcrypto; only workspace admins may save or reveal
 * them and every reveal is appended to the same trail.
 */
import { queryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant, myRolesQuery } from "@/features/platform/queries";
import { traced } from "@/lib/observability";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;
const raw = supabase as unknown as {
  from: (table: string) => AnyBuilder;
  rpc: (fn: string, args?: Record<string, unknown>) => AnyBuilder;
};

function tenant(): string {
  const id = getActiveTenant();
  if (!id) throw new Error("No active workspace resolved yet.");
  return id;
}

export type InfraEntityType =
  | "camera"
  | "gateway"
  | "ai_engine"
  | "camera_credential"
  | "gateway_credential";

export interface InfraAuditEvent {
  id: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  action: string;
  actor_name: string | null;
  changed_fields: string[];
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  summary: string;
  created_at: string;
}

const AUDIT_COLUMNS =
  "id,entity_type,entity_id,entity_name,action,actor_name,changed_fields,before_state,after_state,summary,created_at";

/** Change history for one device family (cameras, gateways or AI engines). */
export function infraAuditQuery(scope: InfraEntityType[], limit = 300) {
  return queryOptions({
    queryKey: ["infrastructure", "audit", scope.join("|"), limit],
    queryFn: () =>
      traced("supabase.infra-audit", async () => {
        const { data, error } = await raw
          .from("infra_audit_events")
          .select(AUDIT_COLUMNS)
          .eq("company_id", tenant())
          .in("entity_type", scope)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw new Error(error.message);
        return (data ?? []) as InfraAuditEvent[];
      }),
    staleTime: 10_000,
  });
}

export const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  decommissioned: "Decommissioned",
  deleted: "Deleted",
  credential_saved: "Credential saved",
  credential_revealed: "Credential revealed",
};

export function auditToneFor(action: string): "positive" | "warning" | "negative" | "info" {
  if (action === "created") return "positive";
  if (action === "decommissioned" || action === "deleted") return "negative";
  if (action === "credential_revealed") return "warning";
  return "info";
}

/** CSV of the change history for compliance archives. */
export function infraAuditToCsv(rows: InfraAuditEvent[]): string {
  const head = ["Timestamp", "Actor", "Entity", "Device", "Action", "Fields", "Summary"];
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    head.join(","),
    ...rows.map((row) =>
      [
        new Date(row.created_at).toISOString(),
        row.actor_name ?? "System",
        row.entity_type,
        row.entity_name ?? "—",
        ACTION_LABELS[row.action] ?? row.action,
        row.changed_fields.join(" | "),
        row.summary,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\n");
}

/* ------------------------------------------------------------ credentials */

export interface DeviceCredential {
  id: string;
  device_type: "camera" | "gateway";
  device_id: string;
  label: string;
  username: string | null;
  onvif_username: string | null;
  rtsp_url: string | null;
  notes: string | null;
  rotated_at: string | null;
  last_revealed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RevealedCredential {
  username: string | null;
  secret: string | null;
  onvif_username: string | null;
  onvif_secret: string | null;
  rtsp_url: string | null;
}

const CREDENTIAL_COLUMNS =
  "id,device_type,device_id,label,username,onvif_username,rtsp_url,notes,rotated_at,last_revealed_at,created_at,updated_at";

export function deviceCredentialsQuery(deviceType: "camera" | "gateway") {
  return queryOptions({
    queryKey: ["infrastructure", "credentials", deviceType],
    queryFn: () =>
      traced("supabase.device-credentials", async () => {
        const { data, error } = await raw
          .from("device_credentials")
          .select(CREDENTIAL_COLUMNS)
          .eq("company_id", tenant())
          .eq("device_type", deviceType);
        if (error) {
          // Operators without credential access simply see an empty vault.
          if (/permission|row-level/i.test(error.message)) return [] as DeviceCredential[];
          throw new Error(error.message);
        }
        return (data ?? []) as DeviceCredential[];
      }),
    staleTime: 15_000,
  });
}

export interface CredentialDraft {
  deviceType: "camera" | "gateway";
  deviceId: string;
  username: string;
  secret: string;
  onvifUsername?: string;
  onvifSecret?: string;
  rtspUrl?: string;
  notes?: string;
}

/** Stores credentials encrypted at rest; the plaintext never lands in a column. */
export async function saveDeviceCredential(draft: CredentialDraft) {
  const { error } = await raw.rpc("save_device_credential", {
    _device_type: draft.deviceType,
    _device_id: draft.deviceId,
    _username: draft.username || null,
    _secret: draft.secret || null,
    _onvif_username: draft.onvifUsername || null,
    _onvif_secret: draft.onvifSecret || null,
    _rtsp_url: draft.rtspUrl || null,
    _notes: draft.notes || null,
  });
  if (error) throw new Error(humanise(error.message));
}

/** Admin-only decrypt. The database records an audit event for every call. */
export async function revealDeviceCredential(id: string): Promise<RevealedCredential> {
  const { data, error } = await raw.rpc("reveal_device_credential", { _id: id });
  if (error) throw new Error(humanise(error.message));
  return data as RevealedCredential;
}

function humanise(message: string) {
  if (/admins may/i.test(message))
    return "Only workspace admins can view or change stored device credentials.";
  if (/row-level|permission/i.test(message))
    return "Your role does not allow access to device credentials.";
  return message;
}

/* --------------------------------------------------------------- access */

export interface CredentialAccess {
  isLoading: boolean;
  /** Admins may store, rotate and reveal secrets. */
  canManage: boolean;
  /** Operators may see which devices have credentials on file. */
  canView: boolean;
}

export function useCredentialAccess(): CredentialAccess {
  const { data, isPending } = useQuery(myRolesQuery);
  const roles = data ?? [];
  const canManage = roles.some((r) => r === "super_admin" || r === "tenant_admin");
  const canView =
    canManage ||
    roles.some((r) => r === "regional_manager" || r === "outlet_manager" || r === "supervisor");
  return { isLoading: isPending, canManage, canView };
}
