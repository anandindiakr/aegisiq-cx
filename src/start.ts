import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Request tracing: every request carries an `x-trace-id` (reusing the caller's
// when present) so browser reports, server logs and responses correlate.
const tracingMiddleware = createMiddleware().server(async ({ next, request }) => {
  const traceId = request?.headers.get("x-trace-id") ?? crypto.randomUUID();
  const started = Date.now();
  try {
    const result = await next();
    const response = (result as { response?: Response })?.response;
    if (response instanceof Response) response.headers.set("x-trace-id", traceId);
    return result;
  } catch (error) {
    console.error(
      JSON.stringify({
        tag: "aegisiq.request",
        traceId,
        url: request?.url,
        durationMs: Date.now() - started,
        message: error instanceof Error ? error.message : String(error),
      }),
      error,
    );
    throw error;
  }
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
