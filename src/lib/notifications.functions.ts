/**
 * Server functions for notification fan-out.
 *
 * Thin wrapper by design: every runtime helper lives in `notifications.server`
 * so nothing but the exported declarations survives client-side splitting.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NOTIFICATION_EVENTS } from "@/features/command-centre/notificationEvents";
import {
  fanOutEvent,
  assertMembership,
  signPayload,
  webhookBody,
} from "@/lib/notifications.server";

const dispatchSchema = z.object({
  companyId: z.string().uuid(),
  type: z.enum(NOTIFICATION_EVENTS),
  title: z.string().min(1).max(200),
  summary: z.string().max(1000).default(""),
  data: z.record(z.unknown()).default({}),
});

export const dispatchNotificationEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => dispatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMembership(context.supabase, data.companyId);
    const results = await fanOutEvent(data.companyId, {
      type: data.type,
      title: data.title,
      summary: data.summary,
      data: data.data as Record<string, unknown>,
    });
    return { delivered: results.filter((r) => r.status === "sent").length, results };
  });

const testSchema = z.object({
  companyId: z.string().uuid(),
  url: z.string().url(),
  secret: z.string().min(8).max(200),
});

/** Sends a signed `webhook.test` callback so a backend can verify its verifier. */
export const sendTestWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => testSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMembership(context.supabase, data.companyId);
    const body = webhookBody(data.companyId, crypto.randomUUID(), {
      type: "export.completed",
      title: "AegisIQ CX test callback",
      summary: "This is a signed test delivery from your notification settings.",
      data: { test: true },
    });
    const { header } = signPayload(data.secret, body);
    try {
      const response = await fetch(data.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-aegisiq-signature": header,
          "x-aegisiq-event": "webhook.test",
        },
        body,
      });
      return { ok: response.ok, status: response.status };
    } catch (error) {
      return { ok: false, status: 0, error: error instanceof Error ? error.message : "Failed" };
    }
  });
