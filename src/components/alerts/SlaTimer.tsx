import { useEffect, useState } from "react";

import { StatusPill } from "@/components/common/Primitives";
import { alertSlaStatus, SLA_TONE, type AlertSlaPolicy } from "@/features/alerts/sla";
import { cn } from "@/lib/utils";

interface TimerAlert {
  severity: AlertSlaPolicy["severity"];
  status: string;
  triggered_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
}

/**
 * Live SLA countdown for an alert. Re-renders on a shared 30-second cadence so
 * a wall of timers stays cheap.
 */
export function SlaTimer({
  alert,
  policy,
  compact = false,
  className,
}: {
  alert: TimerAlert;
  policy: AlertSlaPolicy | undefined;
  compact?: boolean;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const status = alertSlaStatus(
    {
      severity: alert.severity,
      status: alert.status,
      triggered_at: alert.triggered_at,
      acknowledged_at: alert.acknowledged_at ?? null,
      resolved_at: alert.resolved_at ?? null,
    },
    policy,
    now,
  );

  if (status.state === "none") return null;

  return (
    <span className={cn("inline-flex items-center", className)}>
      <StatusPill
        label={compact ? status.label.replace(/^(Acknowledge|Resolve) · /, "") : status.label}
        tone={SLA_TONE[status.state]}
      />
    </span>
  );
}
