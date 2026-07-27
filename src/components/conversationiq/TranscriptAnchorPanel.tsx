import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Highlighter, Loader2, Quote, Trash2, Users2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/common/Primitives";
import { Chip } from "@/components/conversationiq/Badges";
import {
  createTranscriptAnchor,
  deleteTranscriptAnchor,
  transcriptAnchorsQuery,
  updateTranscriptAnchor,
  type TranscriptAnchor,
} from "@/features/conversationiq/anchors";
import { formatDate, titleCase } from "@/lib/format";

export interface AnchorDraft {
  transcriptId: string | null;
  speaker: string;
  startMs: number;
  endMs: number;
  quote: string;
}

const LABEL_SUGGESTIONS = ["evidence", "coaching", "escalation", "compliance", "highlight"];

export function offsetLabel(ms: number) {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)
    .toString()
    .padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

/**
 * Saved transcript anchors: a highlighted quote pinned to a speaker and time
 * range, with an optional reviewer note and labels.
 */
export function TranscriptAnchorPanel({
  conversationId,
  draft,
  onClearDraft,
}: {
  conversationId: string;
  draft: AnchorDraft | null;
  onClearDraft: () => void;
}) {
  const queryClient = useQueryClient();
  const anchors = useQuery(transcriptAnchorsQuery(conversationId));
  const [note, setNote] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState("");

  useEffect(() => {
    if (draft) {
      setNote("");
      setLabels([]);
      setLabelInput("");
    }
  }, [draft]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["iq", "anchors", conversationId] });
  }

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("Select transcript text to anchor.");
      return createTranscriptAnchor({
        conversationId,
        transcriptId: draft.transcriptId,
        speaker: draft.speaker,
        startMs: draft.startMs,
        endMs: draft.endMs,
        quote: draft.quote,
        note,
        labels,
      });
    },
    onSuccess: () => {
      toast.success("Highlight anchored to the transcript");
      onClearDraft();
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: deleteTranscriptAnchor,
    onSuccess: () => {
      toast.success("Anchor removed");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const editNote = useMutation({
    mutationFn: (input: { id: string; note: string }) =>
      updateTranscriptAnchor(input.id, { note: input.note }),
    onSuccess: () => {
      toast.success("Anchor note updated");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function addLabel(value: string) {
    const clean = value.trim().toLowerCase();
    if (!clean || labels.includes(clean)) return;
    setLabels((prev) => [...prev, clean]);
    setLabelInput("");
  }

  const rows = anchors.data ?? [];

  return (
    <Panel
      title="Transcript anchors"
      description="Highlight transcript text to attach a note or label to an exact speaker and time range."
    >
      {draft ? (
        <div className="mb-4 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Chip tone="info">
              <Users2 className="size-3" /> {titleCase(draft.speaker)}
            </Chip>
            <span className="font-mono">
              {offsetLabel(draft.startMs)} – {offsetLabel(draft.endMs)}
            </span>
          </div>
          <p className="border-l-2 border-primary/50 pl-2 text-sm italic">“{draft.quote}”</p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why does this moment matter?"
            className="min-h-16 bg-surface text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {labels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setLabels((prev) => prev.filter((l) => l !== label))}
              >
                <Chip tone="info">{label} ×</Chip>
              </button>
            ))}
            {LABEL_SUGGESTIONS.filter((l) => !labels.includes(l)).map((label) => (
              <button key={label} type="button" onClick={() => addLabel(label)}>
                <Chip tone="neutral">+ {label}</Chip>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLabel(labelInput);
                }
              }}
              placeholder="Custom label..."
              className="h-9 bg-surface"
            />
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Highlighter className="mr-2 size-4" />
              )}
              Save anchor
            </Button>
            <Button size="sm" variant="ghost" onClick={onClearDraft}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Highlighter className="size-3.5" /> Select text inside an utterance, then press “Anchor”.
        </p>
      )}

      {anchors.isLoading && <p className="text-sm text-muted-foreground">Loading anchors…</p>}
      {!anchors.isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No anchors saved for this conversation yet.</p>
      )}

      <ul className="space-y-3">
        {rows.map((anchor: TranscriptAnchor) => (
          <li key={anchor.id} className="rounded-lg border border-border bg-surface/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <Chip tone="neutral">
                  <Users2 className="size-3" /> {titleCase(anchor.speaker)}
                </Chip>
                <span className="font-mono">
                  {offsetLabel(anchor.start_ms)} – {offsetLabel(anchor.end_ms)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Delete anchor"
                onClick={() => remove.mutate(anchor.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <p className="mt-2 flex gap-2 text-sm">
              <Quote className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span className="italic">“{anchor.quote}”</span>
            </p>
            <Textarea
              defaultValue={anchor.note ?? ""}
              placeholder="Add a reviewer note..."
              className="mt-2 min-h-12 bg-surface text-xs"
              onBlur={(e) => {
                if (e.target.value.trim() !== (anchor.note ?? "").trim()) {
                  editNote.mutate({ id: anchor.id, note: e.target.value });
                }
              }}
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {anchor.labels.map((label) => (
                <Chip key={label} tone="info">
                  {label}
                </Chip>
              ))}
              <span className="ml-auto text-[10px] text-muted-foreground">
                {anchor.author_name ?? "Unknown"} · {formatDate(anchor.created_at)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
