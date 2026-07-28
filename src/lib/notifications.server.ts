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
  status: "sent" | "failed" | "skipped" | "duplicate";
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
  groupId?: string;
  endpointId?: string;
  dedupeKey?: string;
  /** Stable per-target key; retries reuse it with an incrementing attempt. */
  idempotencyKey?: string;
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
      group_id: ctx.groupId ?? null,
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
      dedupe_key: ctx.dedupeKey ?? null,
      idempotency_key: ctx.idempotencyKey ?? null,
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

/** A bulk recipient group: many destinations sharing one delivery schedule. */
export interface GroupRow {
  id: string;
  name: string;
  members: { channel: string; destination: string; label?: string }[];
  events: string[];
  active: boolean;
  timezone: string;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  window_days: number[];
  send_window_start: number;
  send_window_end: number;
  bypass_quiet_for_failures: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

async function recipientEmails(admin: Admin, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data } = await admin.from("profiles").select("email").in("user_id", userIds);
  return ((data ?? []) as { email: string }[]).map((row) => row.email).filter(Boolean);
}

async function record(admin: Admin, row: Record<string, unknown>): Promise<void> {
  // The unique (company_id, idempotency_key, attempt) index makes a repeated
  // write a no-op rather than a duplicate history row.
  await admin.from("notification_deliveries").insert(row);
}

/** Local weekday (0 = Sunday) and hour for a group's configured timezone. */
export function localClock(timezone: string, now = new Date()): { day: number; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      weekday: "short",
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return { day: Math.max(0, days.indexOf(weekday)), hour: hour % 24 };
  } catch {
    return { day: now.getUTCDay(), hour: now.getUTCHours() };
  }
}

/**
 * Decides whether a group may be notified right now.
 * Quiet hours may wrap midnight (22 → 7); failures can opt to ignore them.
 */
export function windowCheck(
  group: GroupRow,
  eventType: string,
  now = new Date(),
): { allowed: boolean; reason?: string } {
  const failure = eventType.endsWith(".failed");
  if (failure && group.bypass_quiet_for_failures) return { allowed: true };
  const { day, hour } = localClock(group.timezone, now);

  const days = group.window_days ?? [];
  if (days.length > 0 && !days.includes(day)) {
    return { allowed: false, reason: `Outside delivery days (${group.timezone})` };
  }

  const start = group.send_window_start ?? 0;
  const end = group.send_window_end ?? 24;
  if (!(hour >= start && hour < end)) {
    return {
      allowed: false,
      reason: `Outside delivery window ${start}:00–${end}:00 ${group.timezone}`,
    };
  }

  const qs = group.quiet_hours_start;
  const qe = group.quiet_hours_end;
  if (qs !== null && qe !== null && qs !== qe) {
    const quiet = qs < qe ? hour >= qs && hour < qe : hour >= qs || hour < qe;
    if (quiet) {
      return { allowed: false, reason: `Quiet hours ${qs}:00–${qe}:00 ${group.timezone}` };
    }
  }
  return { allowed: true };
}

/** Stable per-target key so a retried dispatch resolves to the same delivery. */
export function idempotencyKey(
  companyId: string,
  dedupeKey: string,
  channel: string,
  destination: string,
): string {
  return createHmac("sha256", "aegisiq-notification")
    .update([companyId, dedupeKey, channel, destination].join("|"))
    .digest("hex")
    .slice(0, 40);
}

/** One resolved destination for an event. */
interface Target {
  channel: string;
  destination: string;
  label: string;
  ruleId?: string;
  groupId?: string;
  endpointId?: string;
  secret?: string;
  group?: GroupRow;
}

/** Delivers one event to every matching rule, recipient group and endpoint. */
export async function fanOutEvent(
  companyId: string,
  event: DispatchEvent,
  options: { dedupeKey?: string } = {},
): Promise<DeliveryResult[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as Admin;
  const eventId = randomUUID();
  const dedupeKey = options.dedupeKey ?? null;
  const results: DeliveryResult[] = [];

  const [{ data: ruleRows }, { data: groupRows }, { data: endpointRows }] = await Promise.all([
    admin
      .from("notification_rules")
      .select("id,name,channel,destination,events,recipient_user_ids,active")
      .eq("company_id", companyId)
      .eq("active", true)
      .contains("events", [event.type]),
    admin
      .from("notification_groups")
      .select(
        "id,name,members,events,active,timezone,quiet_hours_start,quiet_hours_end,window_days,send_window_start,send_window_end,bypass_quiet_for_failures",
      )
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

  const targets: Target[] = [];

  for (const rule of (ruleRows ?? []) as RuleRow[]) {
    if (rule.channel === "email") {
      const emails = Array.from(
        new Set([
          ...(await recipientEmails(admin, rule.recipient_user_ids ?? [])),
          ...(rule.destination.includes("@") ? [rule.destination] : []),
        ]),
      );
      if (emails.length === 0) {
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
          dedupe_key: dedupeKey,
          payload: event.data,
        });
        continue;
      }
      for (const to of emails) {
        targets.push({ channel: "email", destination: to, label: rule.name, ruleId: rule.id });
      }
      continue;
    }
    targets.push({
      channel: rule.channel,
      destination: rule.destination,
      label: rule.name,
      ruleId: rule.id,
    });
  }

  for (const group of (groupRows ?? []) as GroupRow[]) {
    for (const member of group.members ?? []) {
      if (!member?.destination) continue;
      targets.push({
        channel: member.channel,
        destination: member.destination,
        label: member.label ? `${group.name} · ${member.label}` : group.name,
        groupId: group.id,
        group,
      });
    }
  }

  for (const endpoint of (endpointRows ?? []) as EndpointRow[]) {
    targets.push({
      channel: "webhook",
      destination: endpoint.url,
      label: endpoint.name,
      endpointId: endpoint.id,
      secret: endpoint.secret,
    });
  }

  const seen = new Set<string>();

  for (const target of targets) {
    const key = dedupeKey
      ? idempotencyKey(companyId, dedupeKey, target.channel, target.destination)
      : null;

    // In-request duplicate: the same destination configured twice.
    const localKey = `${target.channel}|${target.destination}`;
    if (seen.has(localKey)) {
      results.push({
        channel: target.channel,
        destination: target.destination,
        status: "duplicate",
        responseStatus: null,
        error: "Already notified in this dispatch",
      });
      continue;
    }
    seen.add(localKey);

    // Cross-request duplicate: this exact event already reached this target.
    if (key) {
      const { data: existing } = await admin
        .from("notification_deliveries")
        .select("id,status,attempt")
        .eq("company_id", companyId)
        .eq("idempotency_key", key)
        .order("attempt", { ascending: false })
        .limit(1);
      const previous = (existing ?? [])[0] as { status: string; attempt: number } | undefined;
      if (previous && previous.status === "sent") {
        results.push({
          channel: target.channel,
          destination: target.destination,
          status: "duplicate",
          responseStatus: null,
          error: "Suppressed — already delivered for this event",
        });
        await record(admin, {
          company_id: companyId,
          rule_id: target.ruleId ?? null,
          group_id: target.groupId ?? null,
          endpoint_id: target.endpointId ?? null,
          event_id: eventId,
          event_type: event.type,
          channel: target.channel,
          destination: target.destination,
          target_label: target.label,
          status: "duplicate",
          error_message: "Suppressed — already delivered for this event",
          dedupe_key: dedupeKey,
          idempotency_key: key,
          attempt: previous.attempt + 1,
          payload: event.data,
        });
        continue;
      }
    }

    // Scheduled delivery controls: quiet hours and send windows for groups.
    if (target.group) {
      const gate = windowCheck(target.group, event.type);
      if (!gate.allowed) {
        results.push({
          channel: target.channel,
          destination: target.destination,
          status: "skipped",
          responseStatus: null,
          error: gate.reason ?? "Outside delivery window",
        });
        await record(admin, {
          company_id: companyId,
          group_id: target.groupId ?? null,
          event_id: eventId,
          event_type: event.type,
          channel: target.channel,
          destination: target.destination,
          target_label: target.label,
          status: "skipped",
          error_message: gate.reason ?? "Outside delivery window",
          dedupe_key: dedupeKey,
          idempotency_key: key,
          payload: event.data,
        });
        continue;
      }
    }

    if (target.channel === "email") {
      const started = Date.now();
      const outcome = await sendEmail(target.destination, event);
      const status = outcome.error ? (outcome.skipped ? "skipped" : "failed") : "sent";
      results.push({
        channel: "email",
        destination: target.destination,
        status,
        responseStatus: outcome.status || null,
        error: outcome.error,
      });
      await record(admin, {
        company_id: companyId,
        rule_id: target.ruleId ?? null,
        group_id: target.groupId ?? null,
        event_id: eventId,
        event_type: event.type,
        channel: "email",
        destination: target.destination,
        target_label: target.label,
        status,
        response_status: outcome.status || null,
        error_message: outcome.error,
        duration_ms: Date.now() - started,
        dedupe_key: dedupeKey,
        idempotency_key: key,
        payload: event.data,
      });
      continue;
    }

    const isChat = target.channel === "slack" || target.channel === "teams";
    const body = isChat
      ? chatBody(target.channel, event, eventId)
      : webhookBody(companyId, eventId, event);
    const headers: Record<string, string> = isChat
      ? {}
      : {
          "x-aegisiq-event": event.type,
          "x-aegisiq-delivery": eventId,
          "x-aegisiq-idempotency-key": key ?? eventId,
        };
    if (target.secret) {
      headers[SIGNATURE_HEADER] = signPayload(target.secret, body).header;
    }

    const outcome = await deliverWithRetry(admin, {
      companyId,
      eventId,
      event,
      channel: target.channel,
      destination: target.destination,
      label: target.label,
      body,
      headers,
      ruleId: target.ruleId,
      groupId: target.groupId,
      endpointId: target.endpointId,
      dedupeKey: dedupeKey ?? undefined,
      idempotencyKey: key ?? undefined,
    });

    results.push({
      channel: target.channel,
      destination: target.destination,
      status: outcome.error ? "failed" : "sent",
      responseStatus: outcome.status || null,
      error: outcome.error,
      attempts: outcome.attempts,
    });

    if (target.endpointId) {
      await admin
        .from("webhook_endpoints")
        .update({
          last_status: outcome.status || null,
          last_error: outcome.error,
          last_delivery_at: new Date().toISOString(),
        })
        .eq("id", target.endpointId);
    }
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

