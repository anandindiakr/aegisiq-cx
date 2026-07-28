/**
 * Live refresh for the Executive Command Centre, with connection resilience.
 *
 * Conversations, alerts and their derived sentiment aggregates all feed the
 * `executive_overview` function, so any insert/update on those tables makes the
 * cached overview stale. Row events are coalesced into a short debounce window
 * before the query cache is invalidated.
 *
 * When the channel drops (network blip, token refresh, server restart) the hook
 * resubscribes with exponential backoff and surfaces the state — attempts, last
 * error, next retry — so the Live status panel can explain what is happening
 * instead of silently going stale.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/observability";

export type RealtimePhase = "idle" | "connecting" | "live" | "retrying" | "offline";

export interface RealtimeStatus {
  connected: boolean;
  phase: RealtimePhase;
  events: number;
  lastEventAt: string | null;
  connectedAt: string | null;
  attempts: number;
  reconnects: number;
  lastError: string | null;
  nextRetryAt: string | null;
  /** Force an immediate resubscribe. */
  reconnect: () => void;
}

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

/** Exponential backoff with jitter, capped so we always keep trying. */
function backoffDelay(attempt: number): number {
  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1));
  return Math.round(exponential * (0.75 + Math.random() * 0.5));
}

export function useCommandCentreRealtime(
  companyId: string | null | undefined,
  enabled = true,
): RealtimeStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Omit<RealtimeStatus, "reconnect">>({
    connected: false,
    phase: "idle",
    events: 0,
    lastEventAt: null,
    connectedAt: null,
    attempts: 0,
    reconnects: 0,
    lastError: null,
    nextRetryAt: null,
  });
  const [manualNonce, setManualNonce] = useState(0);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const everConnected = useRef(false);
  const notifiedOffline = useRef(false);

  const reconnect = useCallback(() => {
    attemptRef.current = 0;
    setManualNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !companyId) {
      setStatus((prev) => ({ ...prev, connected: false, phase: "idle" }));
      return;
    }

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;

    const refresh = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["executive-overview"] });
      }, 1500);
    };

    const onChange = () => {
      setStatus((prev) => ({
        ...prev,
        connected: true,
        phase: "live",
        events: prev.events + 1,
        lastEventAt: new Date().toISOString(),
      }));
      refresh();
    };

    const scheduleRetry = (reason: string) => {
      if (cancelled) return;
      attemptRef.current += 1;
      const delay = backoffDelay(attemptRef.current);
      const at = new Date(Date.now() + delay).toISOString();
      setStatus((prev) => ({
        ...prev,
        connected: false,
        phase: attemptRef.current > 4 ? "offline" : "retrying",
        attempts: attemptRef.current,
        lastError: reason,
        nextRetryAt: at,
      }));

      if (everConnected.current && !notifiedOffline.current) {
        notifiedOffline.current = true;
        toast.warning("Live updates interrupted", {
          description: `${reason} — reconnecting in ${Math.round(delay / 1000)}s.`,
        });
      }
      if (attemptRef.current === 5) {
        captureError(new Error(`Command centre realtime offline: ${reason}`), {
          companyId,
          attempts: attemptRef.current,
        });
      }

      if (retry.current) clearTimeout(retry.current);
      retry.current = setTimeout(() => {
        if (!cancelled) connect();
      }, delay);
    };

    const connect = () => {
      if (cancelled) return;
      if (channel) void supabase.removeChannel(channel);
      setStatus((prev) => ({ ...prev, phase: "connecting", nextRetryAt: null }));

      channel = supabase
        .channel(`command-centre:${companyId}:${attemptRef.current}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
            filter: `company_id=eq.${companyId}`,
          },
          onChange,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "alerts",
            filter: `company_id=eq.${companyId}`,
          },
          onChange,
        )
        .subscribe((state: string, error?: Error) => {
          if (cancelled) return;
          if (state === "SUBSCRIBED") {
            const reconnected = everConnected.current;
            everConnected.current = true;
            if (notifiedOffline.current) {
              notifiedOffline.current = false;
              toast.success("Live updates restored");
            }
            attemptRef.current = 0;
            setStatus((prev) => ({
              ...prev,
              connected: true,
              phase: "live",
              attempts: 0,
              lastError: null,
              nextRetryAt: null,
              connectedAt: new Date().toISOString(),
              reconnects: reconnected ? prev.reconnects + 1 : prev.reconnects,
            }));
            // A dropped window may have missed rows — resync once on connect.
            void queryClient.invalidateQueries({ queryKey: ["executive-overview"] });
            return;
          }
          if (state === "CHANNEL_ERROR") scheduleRetry(error?.message ?? "Channel error");
          if (state === "TIMED_OUT") scheduleRetry("Subscription timed out");
          if (state === "CLOSED" && everConnected.current) scheduleRetry("Connection closed");
        });
    };

    connect();

    const onOnline = () => {
      attemptRef.current = 0;
      connect();
    };
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      if (debounce.current) clearTimeout(debounce.current);
      if (retry.current) clearTimeout(retry.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [companyId, enabled, queryClient, manualNonce]);

  return { ...status, reconnect };
}
