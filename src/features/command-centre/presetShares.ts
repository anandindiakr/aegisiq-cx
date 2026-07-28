/**
 * Shareable preset links.
 *
 * A share link points at a saved preset through an opaque token rather than the
 * preset id. The database resolves it with `preset_by_share_token`, which
 * enforces expiry, revocation and the link's optional role restriction, and
 * returns a read-only copy of the filters. Recipients can apply the view but
 * never edit the underlying preset.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant, type AppRole } from "@/features/platform/queries";
import { defaultFilters, type CommandFilters } from "./filters";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

type RpcClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpcClient = supabase as unknown as RpcClient;

export interface PresetShareLink {
  id: string;
  preset_id: string;
  token: string;
  label: string | null;
  allowed_roles: AppRole[];
  expires_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_by_name: string | null;
  created_at: string;
}

const COLUMNS =
  "id,preset_id,token,label,allowed_roles,expires_at,revoked_at,view_count,last_viewed_at,created_by_name,created_at";

export const presetShareLinksQuery = queryOptions({
  queryKey: ["preset-share-links"],
  queryFn: async () => {
    const { data, error } = await table("preset_share_links")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as PresetShareLink[]).map((row) => ({
      ...row,
      allowed_roles: row.allowed_roles ?? [],
    }));
  },
});

export const SHARE_DURATIONS: { value: number; label: string }[] = [
  { value: 1, label: "24 hours" },
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

export async function createPresetShareLink(input: {
  presetId: string;
  label?: string | null;
  allowedRoles: AppRole[];
  expiresInDays: number;
}): Promise<PresetShareLink> {
  const companyId = getActiveTenant();
  if (!companyId) throw new Error("No active workspace.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const expiresAt = new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString();
  const { data, error } = await table("preset_share_links")
    .insert({
      company_id: companyId,
      preset_id: input.presetId,
      label: input.label ?? null,
      allowed_roles: input.allowedRoles,
      expires_at: expiresAt,
      created_by: auth.user.id,
      created_by_name: profile?.full_name ?? auth.user.email ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as PresetShareLink;
}

export async function revokePresetShareLink(id: string) {
  const { error } = await table("preset_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePresetShareLink(id: string) {
  const { error } = await table("preset_share_links").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function shareLinkUrl(link: Pick<PresetShareLink, "token">): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/shared-preset?token=${link.token}`;
}

export type ShareLinkState = "active" | "expired" | "revoked";

export function shareLinkState(link: PresetShareLink): ShareLinkState {
  if (link.revoked_at) return "revoked";
  if (new Date(link.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

export interface ResolvedShare {
  ok: boolean;
  reason?: "not_found" | "expired" | "revoked" | "forbidden";
  expiresAt?: string;
  label?: string | null;
  preset?: {
    id: string;
    name: string;
    description: string | null;
    filters: CommandFilters;
    scope: string;
  };
}

export const SHARE_REASONS: Record<string, string> = {
  not_found: "This share link does not exist.",
  expired: "This share link has expired. Ask the owner for a fresh one.",
  revoked: "This share link was revoked by its owner.",
  forbidden: "Your role is not on the recipient list for this link.",
};

/** Resolves a token via the database, which enforces expiry and role checks. */
export function sharedPresetQuery(token: string | undefined) {
  return queryOptions({
    queryKey: ["shared-preset", token ?? "none"],
    enabled: Boolean(token),
    retry: false,
    queryFn: async (): Promise<ResolvedShare> => {
      if (!token) return { ok: false, reason: "not_found" };
      const { data, error } = await rpcClient.rpc("preset_by_share_token", { _token: token });
      if (error) throw new Error(error.message);
      return (data ?? { ok: false, reason: "not_found" }) as ResolvedShare;
    },
  });
}

/** Merges the shared snapshot onto current defaults so older links stay valid. */
export function sharedFilters(share: ResolvedShare): CommandFilters {
  return { ...defaultFilters(), ...((share.preset?.filters ?? {}) as Partial<CommandFilters>) };
}
