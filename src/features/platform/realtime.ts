import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { newTraceId, captureError } from "@/lib/observability";
import type { AlertRow } from "./queries";

/**
 * Live alert stream for the signed-in tenant.
 *
 * Subscribes once per mount to `public.alerts` filtered by the tenant's
 * company id (Realtime respects RLS as well), refreshes the alert caches and
 * raises a toast carrying the trace id so an operator can quote it in support.
 */
export function useAlertRealtime(companyId: string | null | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !companyId) return;

    const channel = supabase
      .channel(`alerts:${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alerts",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as AlertRow | undefined;
          if (!row) return;
          void queryClient.invalidateQueries({ queryKey: ["alerts"] });

          if (payload.eventType !== "INSERT") return;
          if (seen.current.has(row.id)) return;
          seen.current.add(row.id);

          const traceId = newTraceId();
          const critical = row.severity === "critical" || row.severity === "high";
          const show = critical ? toast.error : toast.warning;
          show(`${row.severity.toUpperCase()} alert — ${row.title}`, {
            description: `${row.description ?? "New signal detected"} · trace ${traceId.slice(0, 8)}`,
            duration: critical ? 12_000 : 7_000,
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          captureError(new Error("Realtime alert channel failed"), {
            companyId,
            channel: "alerts",
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, enabled, queryClient]);
}
