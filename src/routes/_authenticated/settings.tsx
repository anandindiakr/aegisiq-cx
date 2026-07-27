import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Save } from "lucide-react";

import {
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  companyQuery,
  keywordsQuery,
  languagesQuery,
  updateCompany,
} from "@/features/platform/queries";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Company profile, branding, subscription plan, time zone, language coverage and keyword configuration.",
      },
      { property: "og:title", content: "Settings — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Company profile, branding, subscription and language configuration.",
      },
    ],
  }),
  component: SettingsPage,
});

const PLANS = ["starter", "growth", "enterprise", "enterprise_plus"];
const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Kolkata",
  "America/New_York",
];

function SettingsPage() {
  const { data, isPending, error, refetch } = useQuery(companyQuery);
  const languages = useQuery(languagesQuery);
  const keywords = useQuery(keywordsQuery);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    legal_name: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    subscription_plan: "enterprise",
    timezone: "UTC",
    logo_url: "",
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name,
      legal_name: data.legal_name ?? "",
      contact_email: data.contact_email ?? "",
      contact_phone: data.contact_phone ?? "",
      address: data.address ?? "",
      subscription_plan: data.subscription_plan,
      timezone: data.timezone,
      logo_url: data.logo_url ?? "",
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateCompany(data!.id, form),
    onSuccess: () => {
      toast.success("Company profile saved");
      queryClient.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Tenant configuration: company identity, branding, subscription, localisation and detection rules."
        actions={
          data && (
            <StatusPill
              label={data.status}
              tone={data.status === "active" ? "positive" : "warning"}
            />
          )
        }
      />

      <Tabs defaultValue="company">
        <TabsList className="bg-surface">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="localisation">Localisation</TabsTrigger>
          <TabsTrigger value="detection">Detection</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <Panel title="Company profile" description="Applies to every user in this tenant">
            {isPending ? (
              <LoadingState rows={6} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {(
                  [
                    ["name", "Trading name"],
                    ["legal_name", "Legal entity"],
                    ["contact_email", "Contact email"],
                    ["contact_phone", "Contact phone"],
                    ["logo_url", "Logo URL"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      value={form[key]}
                      maxLength={255}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="bg-surface"
                    />
                  </div>
                ))}

                <div className="space-y-2">
                  <Label>Subscription plan</Label>
                  <Select
                    value={form.subscription_plan}
                    onValueChange={(v) => setForm((f) => ({ ...f, subscription_plan: v }))}
                  >
                    <SelectTrigger className="bg-surface">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Time zone</Label>
                  <Select
                    value={form.timezone}
                    onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
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

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Registered address</Label>
                  <Textarea
                    id="address"
                    value={form.address}
                    maxLength={500}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    className="min-h-20 bg-surface"
                  />
                </div>

                <div className="md:col-span-2">
                  <Button onClick={() => save.mutate()} disabled={save.isPending || !data}>
                    <Save className="mr-2 size-4" /> Save company profile
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="localisation" className="mt-4">
          <Panel
            title="Language coverage"
            description="Languages enabled for transcription and analysis in this tenant"
          >
            {languages.isPending ? (
              <LoadingState rows={4} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(languages.data ?? []).map((lang) => (
                  <div
                    key={lang.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{lang.name}</p>
                      <p className="text-xs text-muted-foreground">{lang.native_name}</p>
                    </div>
                    <StatusPill
                      label={lang.is_active ? "enabled" : "disabled"}
                      tone={lang.is_active ? "positive" : "neutral"}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="detection" className="mt-4">
          <Panel
            title="Keyword library"
            description="Terms that drive alerting, escalation scoring and topic classification"
          >
            {keywords.isPending ? (
              <LoadingState rows={4} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(keywords.data ?? []).map((k) => (
                  <Badge
                    key={k.id}
                    variant="outline"
                    className="border-border px-3 py-1.5 text-xs font-normal"
                  >
                    <Building2 className="mr-2 size-3 text-primary" />
                    {k.term}
                    <span className="ml-2 text-muted-foreground">
                      {k.category} · ×{Number(k.weight).toFixed(1)}
                    </span>
                  </Badge>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
