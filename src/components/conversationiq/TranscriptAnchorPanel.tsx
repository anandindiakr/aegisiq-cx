import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Crosshair,
  Highlighter,
  Loader2,
  Pencil,
  Quote,
  Trash2,
  Users2,
  X,
} from "lucide-react";
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
import { useIqAccess } from "@/features/conversationiq/access";
import { formatDate, titleCase } from "@/lib/format";

export interface AnchorDraft {
  transcriptId: string | null;
  speaker: string;
  startMs: number;
  endMs: number;
  quote: string;
}

const LABEL_SUGGESTIONS = ["evidence", "coaching", "escalation", "compliance", "highlight"];

/** Parses an "mm:ss" (or plain seconds) offset back into milliseconds. */
export function parseOffset(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;
  const seconds =
    parts.length === 1
      ? Number(parts[0])
      : parts.reduce((total, part) => total * 60 + Number(part), 0);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds * 1000);
}

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
  onJump,
}: {
  conversationId: string;
  draft: AnchorDraft | null;
  onClearDraft: () => void;
  /** Sends the transcript viewer to this anchor's speaker and time range. */
  onJump?: (anchor: TranscriptAnchor) => void;
}) {
  const queryClient = useQueryClient();
  const access = useIqAccess();
  const canEdit = access.can("editAnchors");
  const anchors = useQuery(transcriptAnchorsQuery(conversationId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSpeaker, setEditSpeaker] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [note, setNote] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [labelFilter, setLabelFilter] = useState<string | null>(null);

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

  const editRange = useMutation({
    mutationFn: (input: { id: string; speaker: string; startMs: number; endMs: number }) =>
      updateTranscriptAnchor(input.id, {
        speaker: input.speaker,
        startMs: input.startMs,
        endMs: input.endMs,
      }),
    onSuccess: () => {
      toast.success("Anchor updated");
      setEditingId(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function beginEdit(anchor: TranscriptAnchor) {
    setEditingId(anchor.id);
    setEditSpeaker(anchor.speaker);
    setEditStart(offsetLabel(anchor.start_ms));
    setEditEnd(offsetLabel(anchor.end_ms));
  }

  function commitEdit(anchor: TranscriptAnchor) {
    const startMs = parseOffset(editStart);
    const endMs = parseOffset(editEnd);
    if (startMs === null || endMs === null) {
      toast.error("Use mm:ss for the anchor start and end times.");
      return;
    }
    if (endMs < startMs) {
      toast.error("The anchor end time must be after its start time.");
      return;
    }
    if (!editSpeaker.trim()) {
      toast.error("An anchor needs a speaker.");
      return;
    }
    editRange.mutate({ id: anchor.id, speaker: editSpeaker.trim(), startMs, endMs });
  }

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
      {draft && canEdit ? (
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
          <Highlighter className="size-3.5" />{" "}
          {canEdit
            ? "Select text inside an utterance, then press “Anchor”."
            : "Your role can view anchors but not create or change them."}
        </p>
      )}

      {anchors.isLoading && <p className="text-sm text-muted-foreground">Loading anchors…</p>}
      {!anchors.isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No anchors saved for this conversation yet.</p>
      )}

      {rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setLabelFilter(null)}>
            <Chip tone={labelFilter === null ? "info" : "neutral"}>All · {rows.length}</Chip>
          </button>
          {Array.from(new Set(rows.flatMap((a: TranscriptAnchor) => a.labels))).map(
            (label: string) => (
              <button key={label} type="button" onClick={() => setLabelFilter(label)}>
                <Chip tone={labelFilter === label ? "info" : "neutral"}>{label}</Chip>
              </button>
            ),
          )}
        </div>
      )}

      <ul className="space-y-3">
        {rows
          .filter((anchor: TranscriptAnchor) => !labelFilter || anchor.labels.includes(labelFilter))
          .map((anchor: TranscriptAnchor) => (
            <li key={anchor.id} className="rounded-lg border border-border bg-surface/50 p-3">
              <div className="flex items-start justify-between gap-2">
                {editingId === anchor.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={editSpeaker}
                      onChange={(e) => setEditSpeaker(e.target.value)}
                      aria-label="Anchor speaker"
                      className="h-7 w-32 bg-surface text-xs"
                    />
                    <Input
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                      aria-label="Anchor start time"
                      placeholder="mm:ss"
                      className="h-7 w-20 bg-surface font-mono text-xs"
                    />
                    <Input
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                      aria-label="Anchor end time"
                      placeholder="mm:ss"
                      className="h-7 w-20 bg-surface font-mono text-xs"
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <Chip tone="neutral">
                      <Users2 className="size-3" /> {titleCase(anchor.speaker)}
                    </Chip>
                    <span className="font-mono">
                      {offsetLabel(anchor.start_ms)} – {offsetLabel(anchor.end_ms)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  {canEdit &&
                    (editingId === anchor.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="Save anchor range"
                          disabled={editRange.isPending}
                          onClick={() => commitEdit(anchor)}
                        >
                          {editRange.isPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="Cancel anchor edit"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Edit anchor"
                        onClick={() => beginEdit(anchor)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    ))}
                  {onJump && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => onJump(anchor)}
                    >
                      <Crosshair className="mr-1 size-3.5" /> Jump
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Delete anchor"
                      onClick={() => remove.mutate(anchor.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-2 flex gap-2 text-sm">
                <Quote className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span className="italic">“{anchor.quote}”</span>
              </p>
              <Textarea
                defaultValue={anchor.note ?? ""}
                readOnly={!canEdit}
                placeholder={canEdit ? "Add a reviewer note..." : "No reviewer note"}
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
