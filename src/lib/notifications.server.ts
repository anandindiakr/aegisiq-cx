/**
 * Server-side notification fan-out and signed webhook transport.
 *
 * Server-only (never imported by the browser): it uses the service-role client
 * to read notification rules and webhook endpoints — webhook rows hold signing
 * secrets that must never reach a client bundle — and writes an append-only
 * delivery record for every attempt.
 */
import { createHmac, randomUUID } from "node:crypto";

import type { NotificationEvent } from "@/features/command-centre/notificationEvents";

export interface DispatchEvent {
  type: NotificationEvent;
  title: string;
  summary: string;
  data: Record<string, unknown>;
}

export interface DeliveryResult {
  channel: string;
  destination: string;
  status: "sent" | "failed" | "skipped";
  responseStatus: number | null;
  error: string | null;
  /** How many HTTP attempts this delivery took (email is always 1). */
  attempts?: number;
}

const TIMEOUT_MS = 10_000;
/** Total attempts per HTTP delivery — 1 initial try plus 2 backed-off retries. */
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 600;
const SIGNATURE_HEADER = "x-aegisiq-signature";

/** `t=<unix seconds>,v1=<hex hmac of "t.body">` — Stripe-style, replay safe. */
export function signPayload(
  secret: string,
  body: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return { header: `t=${timestamp},v1=${signature}`, timestamp, signature };
}

function redact(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return text.length > 500 ? `${text.slice(0, 500)}…` : text;
}

async function postJson(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<{ status: number; error: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { status: response.status, error: redact(text) || `HTTP ${response.status}` };
    }
    return { status: response.status, error: null };
  } catch (error) {
    return { status: 0, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** 5xx, 429 and transport failures are transient; 4xx is a caller mistake. */
function isRetryable(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface AttemptContext {
  companyId: string;
  eventId: string;
  event: DispatchEvent;
  channel: string;
  destination: string;
  label: string;
  body: string;
  headers: Record<string, string>;
  ruleId?: string;
  endpointId?: string;
}

/**
 * Posts a webhook/chat delivery with exponential backoff and writes one
 * delivery row per attempt, so the history shows every try (and why it
 * failed) rather than only the final outcome.
 */
async function deliverWithRetry(
  admin: Admin,
  ctx: AttemptContext,
): Promise<{ status: number; error: string | null; attempts: number }> {
  let outcome = { status: 0, error: "not attempted" as string | null };
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    const started = Date.now();
    outcome = await postJson(ctx.destination, ctx.body, {
      ...ctx.headers,
      "x-aegisiq-attempt": String(attempt),
    });
    const retryable = outcome.error !== null && isRetryable(outcome.status);
    const willRetry = retryable && attempt < MAX_ATTEMPTS;
    await record(admin, {
      company_id: ctx.companyId,
      rule_id: ctx.ruleId ?? null,
      endpoint_id: ctx.endpointId ?? null,
      event_id: ctx.eventId,
      event_type: ctx.event.type,
      channel: ctx.channel,
      destination: ctx.destination,
      target_label: ctx.label,
      status: outcome.error ? "failed" : "sent",
      response_status: outcome.status || null,
      error_message: willRetry ? `${outcome.error} — retrying (attempt ${attempt})` : outcome.error,
      duration_ms: Date.now() - started,
      attempt,
      payload: ctx.event.data,
    });
    if (!outcome.error || !retryable) break;
    if (willRetry) await wait(BACKOFF_BASE_MS * 2 ** (attempt - 1));
  }

  return { ...outcome, attempts: attempt };
}

function chatBody(channel: string, event: DispatchEvent, eventId: string): string {
  const lines = [
    `*${event.title}*`,
    event.summary,
    ...Object.entries(event.data).map(([key, value]) => `• ${key}: ${redact(value)}`),
  ];
  if (channel === "teams") {
    return JSON.stringify({
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: event.title,
      themeColor: event.type.endsWith(".failed") ? "D64545" : "2F6FEB",
      title: event.title,
      text: lines.slice(1).join("\n\n"),
    });
  }
  return JSON.stringify({ text: lines.join("\n"), attachments: [], metadata: { eventId } });
}

export function webhookBody(companyId: string, eventId: string, event: DispatchEvent): string {
  return JSON.stringify({
    id: eventId,
    type: event.type,
    created_at: new Date().toISOString(),
    company_id: companyId,
    title: event.title,
    summary: event.summary,
    data: event.data,
  });
}

async function sendEmail(
  to: string,
  event: DispatchEvent,
): Promise<{ status: number; error: string | null; skipped?: boolean }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const senderDomain = process.env.EMAIL_SENDER_DOMAIN;
  if (!apiKey || !senderDomain) {
    return {
      status: 0,
      error: "Email sending needs a verified sender domain for this workspace.",
      skipped: true,
    };
  }
  try {
    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const rows = Object.entries(event.data)
      .map(
        ([key, value]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${key}</td><td style="padding:4px 0">${redact(value)}</td></tr>`,
      )
      .join("");
    await sendLovableEmail(
      {
        to,
        from: `AegisIQ CX <notifications@${senderDomain}>`,
        sender_domain: senderDomain,
        subject: event.title,
        html: `<div style="font-family:Arial,sans-serif"><h2 style="margin:0 0 8px">${event.title}</h2><p style="color:#334155">${event.summary}</p><table>${rows}</table></div>`,
        text: `${event.title}\n\n${event.summary}`,
        purpose: "transactional",
      },
      { apiKey },
    );
    return { status: 200, error: null };
  } catch (error) {
    return { status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

interface RuleRow {
  id: string;
  name: string;
  channel: string;
  destination: string;
  events: string[];
  recipient_user_ids: string[];
  active: boolean;
}

interface EndpointRow {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

async function recipientEmails(admin: Admin, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data } = await admin.from("profiles").select("email").in("user_id", userIds);
  return ((data ?? []) as { email: string }[]).map((row) => row.email).filter(Boolean);
}

async function record(admin: Admin, row: Record<string, unknown>): Promise<void> {
  await admin.from("notification_deliveries").insert(row);
}

/** Delivers one event to every matching rule and webhook endpoint. */
export async function fanOutEvent(
  companyId: string,
  event: DispatchEvent,
): Promise<DeliveryResult[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as Admin;
  const eventId = randomUUID();
  const results: DeliveryResult[] = [];

  const [{ data: ruleRows }, { data: endpointRows }] = await Promise.all([
    admin
      .from("notification_rules")
      .select("id,name,channel,destination,events,recipient_user_ids,active")
      .eq("company_id", companyId)
      .eq("active", true)
      .contains("events", [event.type]),
    admin
      .from("webhook_endpoints")
      .select("id,name,url,secret,events,active")
      .eq("company_id", companyId)
      .eq("active", true)
      .contains("events", [event.type]),
  ]);

  for (const rule of (ruleRows ?? []) as RuleRow[]) {
    const started = Date.now();
    if (rule.channel === "email") {
      const targets = Array.from(
        new Set([
          ...(await recipientEmails(admin, rule.recipient_user_ids ?? [])),
          ...(rule.destination.includes("@") ? [rule.destination] : []),
        ]),
      );
      if (targets.length === 0) {
        results.push({
          channel: "email",
          destination: rule.destination,
          status: "skipped",
          responseStatus: null,
          error: "No recipients selected",
        });
        await record(admin, {
          company_id: companyId,
          rule_id: rule.id,
          event_id: eventId,
          event_type: event.type,
          channel: "email",
          destination: rule.destination,
          target_label: rule.name,
          status: "skipped",
          error_message: "No recipients selected",
          payload: event.data,
        });
        continue;
      }
      for (const to of targets) {
        const outcome = await sendEmail(to, event);
        const status = outcome.error ? (outcome.skipped ? "skipped" : "failed") : "sent";
        results.push({
          channel: "email",
          destination: to,
          status,
          responseStatus: outcome.status || null,
          error: outcome.error,
        });
        await record(admin, {
          company_id: companyId,
          rule_id: rule.id,
          event_id: eventId,
          event_type: event.type,
          channel: "email",
          destination: to,
          target_label: rule.name,
          status,
          response_status: outcome.status || null,
          error_message: outcome.error,
          duration_ms: Date.now() - started,
          payload: event.data,
        });
      }
      continue;
    }

    const isChat = rule.channel === "slack" || rule.channel === "teams";
    const body = isChat
      ? chatBody(rule.channel, event, eventId)
      : webhookBody(companyId, eventId, event);
    const headers: Record<string, string> = isChat
      ? {}
      : {
          "x-aegisiq-event": event.type,
          "x-aegisiq-delivery": eventId,
        };
    const outcome = await deliverWithRetry(admin, {
      companyId,
      eventId,
      event,
      channel: rule.channel,
      destination: rule.destination,
      label: rule.name,
      body,
      headers,
      ruleId: rule.id,
    });
    results.push({
      channel: rule.channel,
      destination: rule.destination,
      status: outcome.error ? "failed" : "sent",
      responseStatus: outcome.status || null,
      error: outcome.error,
      attempts: outcome.attempts,
    });
  }

  for (const endpoint of (endpointRows ?? []) as EndpointRow[]) {
    const body = webhookBody(companyId, eventId, event);
    const { header } = signPayload(endpoint.secret, body);
    const outcome = await deliverWithRetry(admin, {
      companyId,
      eventId,
      event,
      channel: "webhook",
      destination: endpoint.url,
      label: endpoint.name,
      body,
      headers: {
        [SIGNATURE_HEADER]: header,
        "x-aegisiq-event": event.type,
        "x-aegisiq-delivery": eventId,
      },
      endpointId: endpoint.id,
    });
    results.push({
      channel: "webhook",
      destination: endpoint.url,
      status: outcome.error ? "failed" : "sent",
      responseStatus: outcome.status || null,
      error: outcome.error,
      attempts: outcome.attempts,
    });
    await admin
      .from("webhook_endpoints")
      .update({
        last_status: outcome.status || null,
        last_error: outcome.error,
        last_delivery_at: new Date().toISOString(),
      })
      .eq("id", endpoint.id);
  }

  return results;
}

/** Confirms the caller really belongs to the workspace they claim. */
export async function assertMembership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  companyId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not a member of this workspace.");
}
