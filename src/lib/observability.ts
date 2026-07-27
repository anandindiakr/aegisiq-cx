/**
 * Production error reporting + request tracing.
 *
 * Every browser session gets a session id; every route load / API call gets a
 * trace id. Errors are enriched with the signed-in user and their tenant, then
 * forwarded to the Lovable error pipeline AND to `/api/public/telemetry`, which
 * emits a structured server log line visible in real time.
 */
import { reportLovableError } from "./lovable-error-reporting";

export type Severity = "error" | "warning" | "info";

export interface ObservabilityContext {
  userId?: string | null;
  email?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  roles?: string[];
}

export interface TelemetryEvent {
  kind: "error" | "trace";
  name: string;
  message: string;
  severity: Severity;
  traceId: string;
  sessionId: string;
  route: string;
  stack?: string;
  durationMs?: number;
  status?: number;
  context: ObservabilityContext & Record<string, unknown>;
  at: string;
}

const TELEMETRY_ENDPOINT = "/api/public/telemetry";

let context: ObservabilityContext = {};
let sessionId = "";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

/** Stable id for the browser session, used to correlate all of its traces. */
export function getSessionId() {
  if (typeof window === "undefined") return "ssr";
  if (sessionId) return sessionId;
  const stored = window.sessionStorage?.getItem("aegisiq.session_id");
  sessionId = stored ?? randomId();
  try {
    window.sessionStorage?.setItem("aegisiq.session_id", sessionId);
  } catch {
    /* storage unavailable (private mode) — in-memory id is still useful */
  }
  return sessionId;
}

/** New correlation id for a single operation (route load, query, mutation). */
export function newTraceId() {
  return randomId();
}

/** Attach signed-in user + tenant to every subsequent report. */
export function setObservabilityContext(next: ObservabilityContext) {
  context = { ...context, ...next };
}

export function clearObservabilityContext() {
  context = {};
}

export function getObservabilityContext(): Readonly<ObservabilityContext> {
  return context;
}

function currentRoute() {
  if (typeof window === "undefined") return "ssr";
  return window.location.pathname + window.location.search;
}

function send(event: TelemetryEvent) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify(event);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(TELEMETRY_ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  void fetch(TELEMETRY_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trace-id": event.traceId },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

function normalise(error: unknown) {
  if (error instanceof Error)
    return { name: error.name, message: error.message, stack: error.stack };
  if (error instanceof Response)
    return { name: "HttpError", message: `Request failed with status ${error.status}` };
  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
}

/** Report a route/API failure with user + tenant context. */
export function captureError(
  error: unknown,
  extra: Record<string, unknown> = {},
  severity: Severity = "error",
) {
  const { name, message, stack } = normalise(error);
  const traceId = (extra.traceId as string) ?? newTraceId();

  reportLovableError(error, { ...context, ...extra, traceId, sessionId: getSessionId() });

  send({
    kind: "error",
    name,
    message,
    severity,
    stack,
    traceId,
    sessionId: getSessionId(),
    route: currentRoute(),
    context: { ...context, ...extra },
    at: new Date().toISOString(),
  });

  if (import.meta.env?.DEV) console.error(`[trace ${traceId}]`, error, { ...context, ...extra });
  return traceId;
}

/**
 * Wraps an async operation (Supabase query, mutation, server fn) with a trace
 * id, duration measurement and automatic error reporting.
 */
export async function traced<T>(
  name: string,
  operation: (traceId: string) => Promise<T>,
  extra: Record<string, unknown> = {},
): Promise<T> {
  const traceId = newTraceId();
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    const result = await operation(traceId);
    const durationMs = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - started,
    );
    if (durationMs > 2_000) {
      send({
        kind: "trace",
        name,
        message: `Slow operation: ${name}`,
        severity: "warning",
        traceId,
        sessionId: getSessionId(),
        route: currentRoute(),
        durationMs,
        context: { ...context, ...extra },
        at: new Date().toISOString(),
      });
    }
    return result;
  } catch (error) {
    captureError(error, { ...extra, operation: name, traceId });
    throw error;
  }
}

/** Install global handlers once, from the app root. */
export function installGlobalErrorReporting() {
  if (typeof window === "undefined") return () => undefined;
  const onError = (event: ErrorEvent) =>
    captureError(event.error ?? event.message, { mechanism: "onerror" });
  const onRejection = (event: PromiseRejectionEvent) =>
    captureError(event.reason, { mechanism: "unhandledrejection" });

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
