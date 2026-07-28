import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Languages as LanguagesIcon, Plus } from "lucide-react";

import { ErrorState, LoadingState, Panel, StatusPill } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  adminLanguagesQuery,
  createLanguage,
  updateLanguage,
  type LanguageCapabilities,
} from "@/features/administration/queries";

export const Route = createFileRoute("/_authenticated/administration/languages")({
  component: LanguagesPage,
});

const CAPABILITIES: { key: keyof LanguageCapabilities; label: string }[] = [
  { key: "speech_recognition", label: "Speech recognition" },
  { key: "translation", label: "Translation" },
  { key: "sentiment", label: "Sentiment" },
  { key: "keyword_dictionary", label: "Keyword dictionary" },
];

const ROADMAP = [
  { code: "hi", name: "Hindi", native_name: "हिन्दी" },
  { code: "th", name: "Thai", native_name: "ไทย" },
  { code: "vi", name: "Vietnamese", native_name: "Tiếng Việt" },
  { code: "ja", name: "Japanese", native_name: "日本語" },
  { code: "ko", name: "Korean", native_name: "한국어" },
];

function LanguagesPage() {
  const { data, isPending, error, refetch } = useQuery(adminLanguagesQuery);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ code: "", name: "", native_name: "", tier: "supported" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-languages"] });

  const patch = useMutation({
    mutationFn: ({ id, ...rest }: { id: string } & Partial<LanguageCapabilities>) =>
      updateLanguage(id, rest),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const add = useMutation({
    mutationFn: () => createLanguage(draft),
    onSuccess: () => {
      toast.success(`${draft.name} added to the language catalogue`);
      setOpen(false);
      setDraft({ code: "", name: "", native_name: "", tier: "supported" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  const rows = data ?? [];
  const missingRoadmap = ROADMAP.filter((r) => !rows.some((l) => l.code === r.code));

  return (
    <div className="space-y-4">
      <Panel
        title="Supported languages"
        description="Enable a language and choose exactly which intelligence services run against it"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 size-4" /> Add language
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add language</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {(
                  [
                    ["code", "ISO code (e.g. hi)"],
                    ["name", "Name"],
                    ["native_name", "Native name"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`lang-${key}`}>{label}</Label>
                    <Input
                      id={`lang-${key}`}
                      value={draft[key]}
                      maxLength={key === "code" ? 8 : 80}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      className="bg-surface"
                    />
                  </div>
                ))}
                {missingRoadmap.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {missingRoadmap.map((r) => (
                      <Button
                        key={r.code}
                        size="sm"
                        variant="outline"
                        onClick={() => setDraft({ ...r, tier: "future" })}
                      >
                        {r.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={() => add.mutate()}
                  disabled={add.isPending || !draft.code || !draft.name}
                >
                  Add language
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {isPending ? (
          <LoadingState rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Language</TableHead>
                  <TableHead>Enabled</TableHead>
                  {CAPABILITIES.map((c) => (
                    <TableHead key={String(c.key)}>{c.label}</TableHead>
                  ))}
                  <TableHead>Availability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((lang) => (
                  <TableRow key={lang.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <LanguagesIcon className="size-4 text-primary" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{lang.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lang.native_name ?? lang.code.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        aria-label={`Enable ${lang.name}`}
                        checked={lang.is_active}
                        onCheckedChange={(v) => patch.mutate({ id: lang.id, is_active: v })}
                      />
                    </TableCell>
                    {CAPABILITIES.map((c) => (
                      <TableCell key={String(c.key)}>
                        <Switch
                          aria-label={`${c.label} for ${lang.name}`}
                          checked={Boolean(lang[c.key])}
                          disabled={!lang.is_active}
                          onCheckedChange={(v) => patch.mutate({ id: lang.id, [c.key]: v })}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <StatusPill
                        label={lang.tier === "future" ? "roadmap" : "supported"}
                        tone={lang.tier === "future" ? "info" : "positive"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
