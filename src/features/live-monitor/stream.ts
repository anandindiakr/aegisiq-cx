import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/observability";

export type LiveStatus = "connecting" | "live" | "paused" | "error";

export interface LiveEvent {
  id: string;
  kind: "alert" | "conversation" | "camera";
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  at: string;
}

interface Options {
  companyId: string | null | undefined;
  paused: boolean;
  onAlert?: (row: Record<string, unknown>) => void;
}

/**
 * Single multiplexed realtime channel for the Live Monitor.
 *
 * Subscribes to alerts, conversations and camera health for the active tenant,
 * refreshes the relevant query caches and keeps a rolling in-memory event feed.
 * The channel is torn down on unmount or when the operator pauses the stream.
 */
export function useLiveMonitorStream({ companyId, paused, onAlert }: Options) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  const push = useCallback((event: LiveEvent) => {
    setLastEventAt(event.at);
    setEvents((prev) => [event, ...prev].slice(0, 50));
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  useEffect(() => {
    if (!companyId) return;
    if (paused) {
      setStatus("paused");
      return;
    }

    setStatus("connecting");
    const filter = `company_id=eq.${companyId}`;
    const channel = supabase
      .channel(`live-monitor:${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter }, (p) => {
        const row = (p.new ?? p.old) as Record<string, unknown> | undefined;
        void queryClient.invalidateQueries({ queryKey: ["alerts"] });
        if (!row || p.eventType !== "INSERT") return;
        const severity = String(row.severity ?? "info");
        onAlertRef.current?.(row);
        push({
          id: `alert-${String(row.id)}-${Date.now()}`,
          kind: "alert",
          title: String(row.title ?? "New alert"),
          detail: String(row.description ?? "Signal raised"),
          severity:
            severity === "critical" || severity === "high"
              ? "critical"
              : severity === "medium"
                ? "warning"
                : "info",
          at: new Date().toISOString(),
        });
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter },
        (p) => {
          const row = p.new as Record<string, unknown>;
          void queryClient.invalidateQueries({ queryKey: ["live-monitor", "conversations"] });
          push({
            id: `conv-${String(row.id)}-${Date.now()}`,
            kind: "conversation",
            title: `Conversation ${String(row.reference ?? "")}`,
            detail: `${String(row.sentiment ?? "neutral")} · ${String(row.language_code ?? "en").toUpperCase()}`,
            severity: row.escalated ? "warning" : "info",
            at: new Date().toISOString(),
          });
        },
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cameras", filter }, (p) => {
        const row = p.new as Record<string, unknown>;
        void queryClient.invalidateQueries({ queryKey: ["cameras"] });
        const state = String(row.status ?? "unknown");
        push({
          id: `cam-${String(row.id)}-${Date.now()}`,
          kind: "camera",
          title: `${String(row.name ?? "Camera")} is ${state}`,
          detail: String(row.location ?? "Estate device"),
          severity: state === "offline" ? "critical" : state === "degraded" ? "warning" : "info",
          at: new Date().toISOString(),
        });
      })
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setStatus("live");
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          setStatus("error");
          captureError(new Error("Live monitor channel failed"), { companyId, state });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, paused, push, queryClient]);

  return { status, events, lastEventAt, clearEvents };
}
