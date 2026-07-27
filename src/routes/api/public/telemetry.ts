import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Telemetry sink for browser error reports and traces.
 *
 * Public by design (errors happen before/without a session), so the payload is
 * strictly validated, size-capped, and never trusted for writes — it only
 * produces a structured server log line that surfaces in real-time logs.
 */
const eventSchema = z.object({
  kind: z.enum(["error", "trace"]),
  name: z.string().max(200),
  message: z.string().max(2000),
  severity: z.enum(["error", "warning", "info"]).default("error"),
  traceId: z.string().max(100),
  sessionId: z.string().max(100),
  route: z.string().max(500),
  stack: z.string().max(8000).optional(),
  durationMs: z.number().nonnegative().optional(),
  status: z.number().optional(),
  context: z.record(z.unknown()).default({}),
  at: z.string().max(40),
});

const MAX_BODY_BYTES = 32_000;

export const Route = createFileRoute("/api/public/telemetry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
          return new Response("Payload too large", { status: 413 });
        }

        let parsed;
        try {
          parsed = eventSchema.safeParse(JSON.parse(raw));
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });

        const event = parsed.data;
        const ctx = event.context as Record<string, unknown>;
        const line = {
          tag: "aegisiq.telemetry",
          kind: event.kind,
          severity: event.severity,
          traceId: event.traceId,
          sessionId: event.sessionId,
          route: event.route,
          name: event.name,
          message: event.message,
          durationMs: event.durationMs,
          userId: ctx.userId ?? null,
          companyId: ctx.companyId ?? null,
          roles: ctx.roles ?? null,
          userAgent: request.headers.get("user-agent"),
          at: event.at,
        };

        if (event.severity === "error") {
          console.error(JSON.stringify(line), event.stack ?? "");
        } else {
          console.warn(JSON.stringify(line));
        }

        return new Response(null, { status: 204, headers: { "x-trace-id": event.traceId } });
      },
    },
  },
});
