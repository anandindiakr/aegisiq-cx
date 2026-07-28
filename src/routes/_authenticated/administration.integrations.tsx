import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Cloud,
  Mail,
  MessageCircle,
  MessagesSquare,
  Send,
  Server,
  Webhook,
  Plug,
} from "lucide-react";

import { ErrorState, LoadingState, Panel, StatusPill } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  integrationsQuery,
  saveIntegration,
  type IntegrationConnection,
} from "@/features/administration/queries";

export const Route = createFileRoute("/_authenticated/administration/integrations")({
  component: IntegrationsPage,
});

interface Catalogue {
  provider: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  fields: { key: string; label: string; placeholder?: string }[];
}

const CATALOGUE: Catalogue[] = [
  {
    provider: "microsoft_teams",
    name: "Microsoft Teams",
    category: "messaging",
    icon: MessagesSquare,
    description: "Post alerts and executive digests into Teams channels",
    fields: [
      { key: "webhook_url", label: "Incoming webhook URL", placeholder: "https://outlook.office.com/webhook/..." },
      { key: "default_channel", label: "Default channel", placeholder: "CX Operations" },
    ],
  },
  {
    provider: "slack",
    name: "Slack",
    category: "messaging",
    icon: MessagesSquare,
    description: "Route alerts to Slack channels with severity routing",
    fields: [
      { key: "webhook_url", label: "Incoming webhook URL", placeholder: "https://hooks.slack.com/services/..." },
      { key: "default_channel", label: "Default channel", placeholder: "#cx-alerts" },
    ],
  },
  {
    provider: "whatsapp",
    name: "WhatsApp Business",
    category: "messaging",
    icon: MessageCircle,
    description: "Escalate critical incidents to duty managers on WhatsApp",
    fields: [
      { key: "phone_number_id", label: "Phone number ID" },
      { key: "business_account_id", label: "Business account ID" },
    ],
  },
  {
    provider: "telegram",
    name: "Telegram",
    category: "messaging",
    icon: Send,
    description: "Broadcast alerts to a Telegram operations group",
    fields: [
      { key: "chat_id", label: "Chat ID" },
      { key: "bot_username", label: "Bot username", placeholder: "@aegisiq_bot" },
    ],
  },
  {
    provider: "smtp",
    name: "Email (SMTP)",
    category: "email",
    icon: Mail,
    description: "Scheduled reports and alert emails from your own relay",
    fields: [
      { key: "host", label: "SMTP host", placeholder: "smtp.company.com" },
      { key: "port", label: "Port", placeholder: "587" },
      { key: "username", label: "Username" },
      { key: "from_address", label: "From address", placeholder: "cx-alerts@company.com" },
    ],
  },
  {
    provider: "rest_api",
    name: "REST API",
    category: "api",
    icon: Server,
    description: "Expose tenant data to internal systems over authenticated REST",
    fields: [
      { key: "base_url", label: "Base URL", placeholder: "https://api.company.com/aegisiq" },
      { key: "rate_limit", label: "Rate limit (req/min)", placeholder: "600" },
    ],
  },
  {
    provider: "webhook",
    name: "Webhook",
    category: "api",
    icon: Webhook,
    description: "Signed HMAC-SHA256 event delivery to your endpoint",
    fields: [
      { key: "endpoint", label: "Endpoint URL", placeholder: "https://hooks.company.com/aegisiq" },
      { key: "events", label: "Subscribed events", placeholder: "alert.created, report.completed" },
    ],
  },
  {
    provider: "azure",
    name: "Microsoft Azure",
    category: "cloud",
    icon: Cloud,
    description: "Azure Blob archival, Entra ID sync and Azure OpenAI routing",
    fields: [
      { key: "tenant_id", label: "Directory (tenant) ID" },
      { key: "resource_group", label: "Resource group" },
      { key: "region", label: "Region", placeholder: "southeastasia" },
    ],
  },
  {
    provider: "aws",
    name: "Amazon Web Services",
    category: "cloud",
    icon: Cloud,
    description: "S3 archive targets and Kinesis media ingestion",
    fields: [
      { key: "account_id", label: "Account ID" },
      { key: "bucket", label: "S3 bucket" },
      { key: "region", label: "Region", placeholder: "ap-southeast-1" },
    ],
  },
  {
    provider: "google_cloud",
    name: "Google Cloud",
    category: "cloud",
    icon: Cloud,
    description: "GCS archival and Gemini / Speech-to-Text routing",
    fields: [
      { key: "project_id", label: "Project ID" },
      { key: "bucket", label: "Storage bucket" },
      { key: "region", label: "Region", placeholder: "asia-southeast1" },
    ],
  },
];

const CATEGORY_LABEL: Record<string, string> = {
  messaging: "Messaging & collaboration",
  email: "Email",
  api: "APIs & webhooks",
  cloud: "Cloud platforms",
};

function IntegrationsPage() {
  const { data, isPending, error, refetch } = useQuery(integrationsQuery);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Catalogue | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-integrations"] });

  const persist = useMutation({
    mutationFn: (input: {
      entry: Catalogue;
      enabled: boolean;
      config: Record<string, unknown>;
    }) =>
      saveIntegration(input.entry.provider, input.entry.category, {
        enabled: input.enabled,
        status: Object.values(input.config).some((v) => String(v ?? "").trim())
          ? "configured"
          : "not_configured",
        config: input.config,
      }),
    onSuccess: () => {
      toast.success("Integration updated");
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  const byProvider = new Map<string, IntegrationConnection>(
    (data ?? []).map((row) => [row.provider, row]),
  );

  const categories = Array.from(new Set(CATALOGUE.map((c) => c.category)));

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <Panel key={cat} title={CATEGORY_LABEL[cat] ?? cat}>
          {isPending ? (
            <LoadingState rows={3} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {CATALOGUE.filter((c) => c.category === cat).map((entry) => {
                const row = byProvider.get(entry.provider);
                const enabled = row?.enabled ?? false;
                return (
                  <div
                    key={entry.provider}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/25">
                        <entry.icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">{entry.description}</p>
                      </div>
                      <Switch
                        aria-label={`Enable ${entry.name}`}
                        checked={enabled}
                        onCheckedChange={(v) =>
                          persist.mutate({
                            entry,
                            enabled: v,
                            config: (row?.config ?? {}) as Record<string, unknown>,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill
                        label={row?.status ?? "not configured"}
                        tone={
                          row?.status === "configured"
                            ? enabled
                              ? "positive"
                              : "neutral"
                            : "warning"
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(entry);
                          setConfig((row?.config ?? {}) as Record<string, string>);
                        }}
                      >
                        <Plug className="mr-2 size-4" /> Configure
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      ))}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
            <DialogDescription>
              Connection details are stored per workspace. Secrets belong under API Keys, where
              they are encrypted at rest.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {editing?.fields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={`int-${f.key}`}>{f.label}</Label>
                <Input
                  id={`int-${f.key}`}
                  value={config[f.key] ?? ""}
                  placeholder={f.placeholder}
                  maxLength={400}
                  onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                  className="bg-surface"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                editing &&
                persist.mutate({
                  entry: editing,
                  enabled: byProvider.get(editing.provider)?.enabled ?? false,
                  config,
                })
              }
              disabled={persist.isPending}
            >
              Save connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
