import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Eye, KeyRound, Plus, RefreshCcw, Trash2 } from "lucide-react";

import { ErrorState, LoadingState, Panel, StatusPill } from "@/components/common/Primitives";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  apiCredentialsQuery,
  deleteApiCredential,
  revealApiCredential,
  saveApiCredential,
} from "@/features/administration/queries";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/administration/api-keys")({
  component: ApiKeysPage,
});

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "azure_openai", label: "Azure OpenAI" },
  { value: "google_ai", label: "Google AI / Gemini" },
  { value: "anthropic", label: "Anthropic" },
  { value: "whisper", label: "Whisper / Speech" },
  { value: "twilio", label: "Twilio" },
  { value: "sendgrid", label: "SendGrid" },
  { value: "custom", label: "Custom service" },
];

function daysUntil(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function ApiKeysPage() {
  const { data, isPending, error, refetch } = useQuery(apiCredentialsQuery);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<{ provider: string; secret: string } | null>(null);
  const [draft, setDraft] = useState({
    provider: "openai",
    label: "",
    secret: "",
    expiresAt: "",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-api-credentials"] });

  const save = useMutation({
    mutationFn: () =>
      saveApiCredential({
        provider: draft.provider,
        label: draft.label || null,
        secret: draft.secret,
        expiresAt: draft.expiresAt || null,
      }),
    onSuccess: () => {
      toast.success("Key stored — encrypted at rest");
      setOpen(false);
      setDraft({ provider: "openai", label: "", secret: "", expiresAt: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reveal = useMutation({
    mutationFn: (id: string) => revealApiCredential(id),
    onSuccess: (res) => {
      setRevealed({ provider: res.provider, secret: res.secret ?? "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteApiCredential(id),
    onSuccess: () => {
      toast.success("Key revoked");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <Panel
        title="API keys and service credentials"
        description="Secrets are encrypted with the workspace key. Reveal is privileged and written to the audit trail."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 size-4" /> Add key
          </Button>
        }
      >
        {isPending ? (
          <LoadingState rows={5} />
        ) : (data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No credentials stored yet. Add a key to connect AI, speech or messaging providers.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Rotated</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Last revealed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((cred) => {
                  const remaining = daysUntil(cred.expires_at);
                  return (
                    <TableRow key={cred.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <KeyRound className="size-4 text-primary" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium capitalize">
                              {cred.provider.replace(/_/g, " ")}
                            </p>
                            {cred.label && (
                              <p className="text-xs text-muted-foreground">{cred.label}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        ••••••••{cred.hint ?? ""}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(cred.rotated_at)}
                      </TableCell>
                      <TableCell>
                        {remaining === null ? (
                          <StatusPill label="no expiry" tone="neutral" />
                        ) : (
                          <StatusPill
                            label={remaining <= 0 ? "expired" : `${remaining} days`}
                            tone={remaining <= 0 ? "negative" : remaining < 30 ? "warning" : "positive"}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {cred.last_revealed_at ? formatDateTime(cred.last_revealed_at) : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Reveal ${cred.provider} key`}
                            onClick={() => reveal.mutate(cred.id)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Rotate ${cred.provider} key`}
                            onClick={() => {
                              setDraft({
                                provider: cred.provider,
                                label: cred.label ?? "",
                                secret: "",
                                expiresAt: "",
                              });
                              setOpen(true);
                            }}
                          >
                            <RefreshCcw className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Revoke ${cred.provider} key`}
                            onClick={() => remove.mutate(cred.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Store API key</DialogTitle>
            <DialogDescription>
              Saving an existing provider replaces the current secret and records a rotation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={draft.provider}
                onValueChange={(v) => setDraft((d) => ({ ...d, provider: v }))}
              >
                <SelectTrigger className="bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-label">Label</Label>
              <Input
                id="key-label"
                value={draft.label}
                maxLength={120}
                placeholder="Production inference key"
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                className="bg-surface"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-secret">Secret</Label>
              <Input
                id="key-secret"
                type="password"
                value={draft.secret}
                maxLength={2000}
                autoComplete="off"
                onChange={(e) => setDraft((d) => ({ ...d, secret: e.target.value }))}
                className="bg-surface font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-expiry">Expires on</Label>
              <Input
                id="key-expiry"
                type="date"
                value={draft.expiresAt}
                onChange={(e) => setDraft((d) => ({ ...d, expiresAt: e.target.value }))}
                className="bg-surface"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !draft.secret.trim()}>
              Save key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revealed)} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {revealed?.provider.replace(/_/g, " ")} secret
            </DialogTitle>
            <DialogDescription>
              This reveal has been recorded in the audit trail. Close the dialog when you are done.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={revealed?.secret ?? ""} className="bg-surface font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy secret"
              onClick={() => {
                void navigator.clipboard.writeText(revealed?.secret ?? "");
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
