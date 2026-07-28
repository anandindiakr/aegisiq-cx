/**
 * Live refresh for the Executive Command Centre.
 *
 * Conversations, alerts and their derived sentiment aggregates all feed the
 * `executive_overview` function, so any insert/update on those tables makes the
 * cached overview stale. Rather than refetching on every single row event
 * (a busy tenant can produce hundreds a minute) changes are coalesced into a
 * short debounce window before the query cache is invalidated.
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/observability";

export interface RealtimeStatus {
  connected: boolean;
  events: number;
  lastEventAt: string | null;
}

export function useCommandCentreRealtime(
  companyId: string | null | undefined,
  enabled = true,
): RealtimeStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>({
    connected: false,
    events: 0,
    lastEventAt: null,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !companyId) {
      setStatus((prev) => ({ ...prev, connected: false }));
      return;
    }

    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["executive-overview"] });
      }, 1500);
    };

    const onChange = () => {
      setStatus((prev) => ({
        connected: true,
        events: prev.events + 1,
        lastEventAt: new Date().toISOString(),
      }));
      refresh();
    };

    const channel = supabase
      .channel(`command-centre:${companyId}`)
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
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setStatus((prev) => ({ ...prev, connected: true }));
        if (state === "CLOSED" || state === "TIMED_OUT") {
          setStatus((prev) => ({ ...prev, connected: false }));
        }
        if (state === "CHANNEL_ERROR") {
          setStatus((prev) => ({ ...prev, connected: false }));
          captureError(new Error("Command centre realtime channel failed"), {
            companyId,
            channel: "command-centre",
          });
        }
      });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [companyId, enabled, queryClient]);

  return status;
}
