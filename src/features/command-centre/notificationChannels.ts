/**
 * Notification rules, webhook endpoints and delivery history (client side).
 *
 * Rules decide *who* hears about an event and over which channel; webhook
 * endpoints are signed machine callbacks for a customer backend. Both are
 * tenant scoped by row-level security; only company admins may edit them.
 */
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveTenant } from "@/features/platform/queries";
import { captureError } from "@/lib/observability";
import { dispatchNotificationEvent } from "@/lib/notifications.functions";
import type {
  NotificationChannel,
  NotificationEvent,
} from "@/features/command-centre/notificationEvents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase as any).from(name);

export interface NotificationRule {
  id: string;
  name: string;
  channel: NotificationChannel;
  destination: string;
  events: NotificationEvent[];
  recipient_user_ids: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: NotificationEvent[];
  description: string | null;
  active: boolean;
  last_status: number | null;
  last_error: string | null;
  last_delivery_at: string | null;
  created_at: string;
}

export interface NotificationDelivery {
  id: string;
  event_type: string;
  channel: string;
  destination: string;
  target_label: string | null;
  status: "sent" | "failed" | "skipped";
  response_status: number | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

const RULE_COLUMNS =
  "id,name,channel,destination,events,recipient_user_ids,active,created_at,updated_at";
const ENDPOINT_COLUMNS =
  "id,name,url,secret,events,description,active,last_status,last_error,last_delivery_at,created_at";
const DELIVERY_COLUMNS =
  "id,event_type,channel,destination,target_label,status,response_status,error_message,duration_ms,created_at";

export const notificationRulesQuery = queryOptions({
  queryKey: ["notification-rules"],
  queryFn: async () => {
    const { data, error } = await table("notification_rules")
      .select(RULE_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as NotificationRule[];
  },
});

export const webhookEndpointsQuery = queryOptions({
  queryKey: ["webhook-endpoints"],
  queryFn: async () => {
    const { data, error } = await table("webhook_endpoints")
      .select(ENDPOINT_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) {
      // Non-admins cannot read endpoints; an empty list is the correct view.
      if (error.code === "42501") return [] as WebhookEndpoint[];
      throw new Error(error.message);
    }
    return (data ?? []) as WebhookEndpoint[];
  },
});

export const notificationDeliveriesQuery = queryOptions({
  queryKey: ["notification-deliveries"],
  queryFn: async () => {
    const { data, error } = await table("notification_deliveries")
      .select(DELIVERY_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as NotificationDelivery[];
  },
});

export interface RuleInput {
  name: string;
  channel: NotificationChannel;
  destination: string;
  events: NotificationEvent[];
  recipientUserIds: string[];
  active: boolean;
}

function requireTenant(): string {
  const companyId = getActiveTenant();
  if (!companyId) throw new Error("No active workspace.");
  return companyId;
}

export async function saveNotificationRule(input: RuleInput, id?: string): Promise<void> {
  const companyId = requireTenant();
  const { data: auth } = await supabase.auth.getUser();
  const row = {
    company_id: companyId,
    name: input.name.trim(),
    channel: input.channel,
    destination: input.destination.trim(),
    events: input.events,
    recipient_user_ids: input.recipientUserIds,
    active: input.active,
  };
  const { error } = id
    ? await table("notification_rules").update(row).eq("id", id)
    : await table("notification_rules").insert({ ...row, created_by: auth.user?.id ?? null });
  if (error) throw new Error(error.message);
}

export async function deleteNotificationRule(id: string): Promise<void> {
  const { error } = await table("notification_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface EndpointInput {
  name: string;
  url: string;
  secret: string;
  events: NotificationEvent[];
  description: string | null;
  active: boolean;
}

export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `whsec_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function saveWebhookEndpoint(input: EndpointInput, id?: string): Promise<void> {
  const companyId = requireTenant();
  const { data: auth } = await supabase.auth.getUser();
  const row = {
    company_id: companyId,
    name: input.name.trim(),
    url: input.url.trim(),
    secret: input.secret,
    events: input.events,
    description: input.description,
    active: input.active,
  };
  const { error } = id
    ? await table("webhook_endpoints").update(row).eq("id", id)
    : await table("webhook_endpoints").insert({ ...row, created_by: auth.user?.id ?? null });
  if (error) throw new Error(error.message);
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  const { error } = await table("webhook_endpoints").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Fires an event at the configured channels and signed endpoints.
 * Never throws: a notification problem must not fail the action it reports on.
 */
export async function notify(
  type: NotificationEvent,
  title: string,
  summary: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  try {
    const companyId = getActiveTenant();
    if (!companyId) return;
    await dispatchNotificationEvent({ data: { companyId, type, title, summary, data } });
  } catch (error) {
    captureError(error, { area: "notification-dispatch", type });
  }
}
