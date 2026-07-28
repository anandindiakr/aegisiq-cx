import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Save } from "lucide-react";

import { LoadingState, Panel } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsForm } from "@/components/administration/SettingsForm";
import { companyQuery, updateCompany } from "@/features/platform/queries";

export const Route = createFileRoute("/_authenticated/administration/general")({
  component: GeneralSettingsPage,
});

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "America/New_York",
];

function GeneralSettingsPage() {
  const { data, isPending } = useQuery(companyQuery);
  const queryClient = useQueryClient();
  const [identity, setIdentity] = useState({ name: "", logo_url: "", timezone: "UTC" });

  useEffect(() => {
    if (!data) return;
    setIdentity({ name: data.name, logo_url: data.logo_url ?? "", timezone: data.timezone });
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateCompany(data!.id, identity),
    onSuccess: () => {
      toast.success("Workspace identity saved");
      queryClient.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Panel
        title="Workspace identity"
        description="Shown across the console, exported reports and notification templates"
      >
        {isPending ? (
          <LoadingState rows={3} />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company name</Label>
              <Input
                id="company_name"
                value={identity.name}
                maxLength={120}
                onChange={(e) => setIdentity((s) => ({ ...s, name: e.target.value }))}
                className="bg-surface"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                value={identity.logo_url}
                maxLength={500}
                placeholder="https://cdn.company.com/logo.svg"
                onChange={(e) => setIdentity((s) => ({ ...s, logo_url: e.target.value }))}
                className="bg-surface"
              />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={identity.timezone}
                onValueChange={(v) => setIdentity((s) => ({ ...s, timezone: v }))}
              >
                <SelectTrigger className="bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <span className="grid size-10 place-items-center overflow-hidden rounded-lg ring-1 ring-border">
                {identity.logo_url ? (
                  <img
                    src={identity.logo_url}
                    alt="Workspace logo preview"
                    className="size-full object-contain"
                  />
                ) : (
                  <Building2 className="size-4 text-muted-foreground" />
                )}
              </span>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !data}>
                <Save className="mr-2 size-4" /> Save identity
              </Button>
            </div>
          </div>
        )}
      </Panel>

      <SettingsForm
        section="general"
        groups={[
          {
            title: "Presentation",
            description: "Theme and formatting defaults applied to every user in this tenant",
            fields: [
              {
                key: "theme",
                label: "Theme",
                type: "select",
                options: [
                  { value: "dark", label: "Dark (enterprise)" },
                  { value: "system", label: "Follow system" },
                ],
              },
              {
                key: "date_format",
                label: "Date format",
                type: "select",
                options: [
                  { value: "DD MMM YYYY", label: "28 Jul 2026" },
                  { value: "YYYY-MM-DD", label: "2026-07-28" },
                  { value: "MM/DD/YYYY", label: "07/28/2026" },
                ],
              },
              {
                key: "time_format",
                label: "Time format",
                type: "select",
                options: [
                  { value: "24h", label: "24-hour" },
                  { value: "12h", label: "12-hour" },
                ],
              },
              {
                key: "default_language",
                label: "Default language",
                type: "select",
                options: [
                  { value: "en", label: "English" },
                  { value: "zh", label: "Chinese" },
                  { value: "ms", label: "Malay" },
                  { value: "ta", label: "Tamil" },
                  { value: "tl", label: "Tagalog" },
                ],
              },
            ],
          },
          {
            title: "Regional settings",
            description: "Currency and locale conventions for reporting and exports",
            fields: [
              {
                key: "currency",
                label: "Currency",
                type: "select",
                options: [
                  { value: "USD", label: "USD — US Dollar" },
                  { value: "SGD", label: "SGD — Singapore Dollar" },
                  { value: "MYR", label: "MYR — Malaysian Ringgit" },
                  { value: "GBP", label: "GBP — Pound Sterling" },
                  { value: "EUR", label: "EUR — Euro" },
                  { value: "AED", label: "AED — UAE Dirham" },
                ],
              },
              {
                key: "number_format",
                label: "Number format",
                type: "select",
                options: [
                  { value: "1,234.56", label: "1,234.56" },
                  { value: "1.234,56", label: "1.234,56" },
                  { value: "1 234,56", label: "1 234,56" },
                ],
              },
              {
                key: "week_start",
                label: "Week starts on",
                type: "select",
                options: [
                  { value: "monday", label: "Monday" },
                  { value: "sunday", label: "Sunday" },
                ],
              },
              {
                key: "measurement",
                label: "Measurement system",
                type: "select",
                options: [
                  { value: "metric", label: "Metric" },
                  { value: "imperial", label: "Imperial" },
                ],
              },
            ],
          },
        ]}
      />
    </div>
  );
}
