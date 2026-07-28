import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Plus, Trash2, Upload } from "lucide-react";

import { ErrorState, LoadingState, Panel, StatusPill } from "@/components/common/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  adminKeywordsQuery,
  deleteKeyword,
  KEYWORD_CATEGORIES,
  updateKeyword,
  upsertKeywords,
} from "@/features/administration/queries";

export const Route = createFileRoute("/_authenticated/administration/keywords")({
  component: KeywordsPage,
});

const label = (c: string) => c.replace(/_/g, " ");

function KeywordsPage() {
  const { data, isPending, error, refetch } = useQuery(adminKeywordsQuery);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [draft, setDraft] = useState({ term: "", category: "complaint", weight: 1 });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-keywords"] });

  const add = useMutation({
    mutationFn: () => upsertKeywords([draft]),
    onSuccess: () => {
      toast.success("Keyword added");
      setDraft({ term: "", category: draft.category, weight: 1 });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: ({ id, ...rest }: { id: string; is_active?: boolean; weight?: number }) =>
      updateKeyword(id, rest),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteKeyword(id),
    onSuccess: () => {
      toast.success("Keyword removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: () => upsertKeywords(parseBulk(bulkText)),
    onSuccess: () => {
      toast.success("Keyword dictionary imported");
      setBulkOpen(false);
      setBulkText("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter(
      (k) =>
        (category === "all" || k.category === category) &&
        (!term || k.term.toLowerCase().includes(term)),
    );
  }, [data, category, search]);

  const exportCsv = () => {
    const csv = [
      "term,category,weight,active",
      ...(data ?? []).map((k) => `"${k.term}",${k.category},${k.weight},${k.is_active}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `keyword-dictionary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    setBulkText(text.replace(/^term,category,weight.*\n/i, ""));
    setBulkOpen(true);
  };

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <Panel
        title="Add keyword"
        description="Terms drive alerting, escalation scoring and topic classification"
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="kw-term">Term or phrase</Label>
            <Input
              id="kw-term"
              value={draft.term}
              maxLength={120}
              placeholder="speak to the manager"
              onChange={(e) => setDraft((d) => ({ ...d, term: e.target.value }))}
              className="bg-surface"
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={draft.category}
              onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}
            >
              <SelectTrigger className="bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KEYWORD_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {label(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kw-weight">Weight</Label>
            <div className="flex gap-2">
              <Input
                id="kw-weight"
                type="number"
                min={0.1}
                max={5}
                step={0.1}
                value={draft.weight}
                onChange={(e) => setDraft((d) => ({ ...d, weight: Number(e.target.value) }))}
                className="bg-surface"
              />
              <Button onClick={() => add.mutate()} disabled={!draft.term.trim() || add.isPending}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Keyword dictionary"
        description={`${(data ?? []).length} terms across ${KEYWORD_CATEGORIES.length} categories`}
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 size-4" /> Import
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
              <Plus className="mr-2 size-4" /> Bulk upload
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="mr-2 size-4" /> Export
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            value={search}
            placeholder="Search terms"
            maxLength={80}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs bg-surface"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-56 bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {KEYWORD_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {label(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isPending ? (
          <LoadingState rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.term}</TableCell>
                    <TableCell>
                      <StatusPill label={label(k.category)} tone="info" />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0.1}
                        max={5}
                        step={0.1}
                        defaultValue={Number(k.weight)}
                        onBlur={(e) =>
                          patch.mutate({ id: k.id, weight: Number(e.target.value) })
                        }
                        className="h-8 w-20 bg-surface"
                        aria-label={`Weight for ${k.term}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        aria-label={`Activate ${k.term}`}
                        checked={k.is_active}
                        onCheckedChange={(v) => patch.mutate({ id: k.id, is_active: v })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${k.term}`}
                        onClick={() => remove.mutate(k.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk upload keywords</DialogTitle>
            <DialogDescription>
              One row per line: <code>term,category,weight</code>. Category and weight are
              optional and default to custom and 1.0.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="min-h-48 bg-surface font-mono text-xs"
            placeholder={"chargeback,fraud,2\nexpired warranty,warranty,1.5\nsecurity guard,security"}
          />
          <DialogFooter>
            <Button
              onClick={() => bulk.mutate()}
              disabled={bulk.isPending || parseBulk(bulkText).length === 0}
            >
              Import {parseBulk(bulkText).length} keywords
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseBulk(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [term, category, weight] = line.split(",").map((p) => p?.trim().replace(/^"|"$/g, ""));
      return {
        term: term ?? "",
        category: (KEYWORD_CATEGORIES as readonly string[]).includes(category ?? "")
          ? (category as string)
          : "custom",
        weight: Number(weight) > 0 ? Number(weight) : 1,
      };
    })
    .filter((r) => r.term.length > 0);
}
