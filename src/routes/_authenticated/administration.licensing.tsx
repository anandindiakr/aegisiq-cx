import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cctv, Cpu, HardDrive, Store, Users } from "lucide-react";

import { LoadingState, Panel, StatusPill } from "@/components/common/Primitives";
import { Progress } from "@/components/ui/progress";
import { SettingsForm } from "@/components/administration/SettingsForm";
import { SECTION_DEFAULTS, settingsQuery } from "@/features/administration/queries";

export const Route = createFileRoute("/_authenticated/administration/licensing")({
  component: LicensingPage,
});

const num = (doc: Record<string, unknown>, key: string, fallback: number) => {
  const v = Number(doc?.[key]);
  return Number.isFinite(v) ? v : fallback;
};

function LicensingPage() {
  const { data, isPending } = useQuery(settingsQuery("licensing"));
  const doc = (data ?? SECTION_DEFAULTS.licensing) as Record<string, unknown>;

  const usage = [
    {
      label: "Cameras",
      icon: Cctv,
      used: 100,
      limit: num(doc, "camera_limit", 250),
      unit: "devices",
    },
    { label: "Outlets", icon: Store, used: 12, limit: num(doc, "outlet_limit", 40), unit: "sites" },
    { label: "Seats", icon: Users, used: 48, limit: num(doc, "seats", 120), unit: "users" },
    {
      label: "Storage",
      icon: HardDrive,
      used: 1840,
      limit: num(doc, "storage_gb", 5000),
      unit: "GB",
    },
    {
      label: "AI credits",
      icon: Cpu,
      used: num(doc, "ai_credits_used", 118400),
      limit: num(doc, "ai_credits", 250000),
      unit: "credits",
    },
  ];

  const expires = String(doc.expires_at ?? "");
  const daysLeft = expires
    ? Math.ceil((new Date(expires).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="space-y-4">
      <Panel
        title="Subscription"
        description="Entitlements enforced across the tenant"
        actions={
          <StatusPill
            label={
              daysLeft === null
                ? "perpetual"
                : daysLeft <= 0
                  ? "expired"
                  : `${daysLeft} days remaining`
            }
            tone={daysLeft === null ? "info" : daysLeft <= 0 ? "negative" : daysLeft < 60 ? "warning" : "positive"}
          />
        }
      >
        {isPending ? (
          <LoadingState rows={5} />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-primary/12 px-3 py-1.5 text-sm font-semibold capitalize text-primary ring-1 ring-primary/25">
                {String(doc.plan ?? "enterprise").replace(/_/g, " ")} plan
              </span>
              {expires && (
                <span className="text-xs text-muted-foreground">Renews on {expires}</span>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {usage.map((row) => {
                const pct = row.limit > 0 ? Math.min(100, (row.used / row.limit) * 100) : 0;
                return (
                  <div
                    key={row.label}
                    className="rounded-xl border border-border bg-surface/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <row.icon className="size-4 text-primary" />
                        {row.label}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {row.used.toLocaleString()} / {row.limit.toLocaleString()} {row.unit}
                      </span>
                    </div>
                    <Progress value={pct} className="mt-3 h-2" />
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {pct >= 90
                        ? "Approaching entitlement limit — contact your account team"
                        : `${(100 - pct).toFixed(0)}% headroom available`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      <SettingsForm
        section="licensing"
        groups={[
          {
            title: "Entitlements",
            description: "Adjust the contracted limits recorded for this workspace",
            fields: [
              { key: "plan", label: "Plan", type: "select", options: [
                { value: "starter", label: "Starter" },
                { value: "growth", label: "Growth" },
                { value: "enterprise", label: "Enterprise" },
                { value: "enterprise_plus", label: "Enterprise Plus" },
              ] },
              { key: "expires_at", label: "Renewal date", type: "date" },
              { key: "camera_limit", label: "Camera limit", type: "number", min: 1, max: 100000 },
              { key: "outlet_limit", label: "Outlet limit", type: "number", min: 1, max: 10000 },
              { key: "seats", label: "User seats", type: "number", min: 1, max: 100000 },
              { key: "storage_gb", label: "Storage (GB)", type: "number", min: 1, max: 1000000 },
              { key: "ai_credits", label: "AI credits", type: "number", min: 0, max: 100000000 },
              {
                key: "ai_credits_used",
                label: "AI credits consumed",
                type: "number",
                min: 0,
                max: 100000000,
              },
            ],
          },
        ]}
      />
    </div>
  );
}
