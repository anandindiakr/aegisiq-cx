import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquarePlus, Pencil, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useIqAccess } from "@/features/conversationiq/access";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/common/Primitives";
import { Chip } from "@/components/conversationiq/Badges";
import {
  addConversationNote,
  addConversationTag,
  conversationNotesQuery,
  conversationTagsQuery,
  deleteConversationNote,
  removeConversationTag,
  updateConversationNote,
} from "@/features/conversationiq/review";
import { formatDate } from "@/lib/format";

const SUGGESTED_TAGS = [
  "reviewed",
  "follow-up",
  "coaching",
  "escalate",
  "false-positive",
  "compliance",
  "vip-customer",
];

/**
 * Internal review workspace: free-text notes plus short tags that make a
 * previously reviewed conversation findable from the ConversationIQ™ list.
 */
export function ReviewNotesPanel({ conversationId }: { conversationId: string }) {
  const access = useIqAccess();
  const canEdit = access.can("editNotesTags");
  const queryClient = useQueryClient();
  const notes = useQuery(conversationNotesQuery(conversationId));
  const tags = useQuery(conversationTagsQuery(conversationId));

  const [draft, setDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  const applied = useMemo(() => new Set((tags.data ?? []).map((t) => t.tag)), [tags.data]);

  const invalidateNotes = () => {
    void queryClient.invalidateQueries({ queryKey: ["iq", "notes", conversationId] });
  };
  const invalidateTags = () => {
    void queryClient.invalidateQueries({ queryKey: ["iq", "tags", conversationId] });
    void queryClient.invalidateQueries({ queryKey: ["iq", "tag-index"] });
  };
  const fail = (error: Error) => toast.error(error.message);

  const createNote = useMutation({
    mutationFn: (body: string) => addConversationNote(conversationId, body),
    onSuccess: () => {
      setDraft("");
      toast.success("Note added");
      invalidateNotes();
    },
    onError: fail,
  });

  const editNote = useMutation({
    mutationFn: (input: { id: string; body: string }) =>
      updateConversationNote(input.id, input.body),
    onSuccess: () => {
      setEditingId(null);
      toast.success("Note updated");
      invalidateNotes();
    },
    onError: fail,
  });

  const removeNote = useMutation({
    mutationFn: deleteConversationNote,
    onSuccess: () => {
      toast.success("Note deleted");
      invalidateNotes();
    },
    onError: fail,
  });

  const createTag = useMutation({
    mutationFn: (tag: string) => addConversationTag(conversationId, tag),
    onSuccess: () => {
      setTagDraft("");
      invalidateTags();
    },
    onError: fail,
  });

  const dropTag = useMutation({
    mutationFn: removeConversationTag,
    onSuccess: invalidateTags,
    onError: fail,
  });

  return (
    <Panel
      title="Review notes & tags"
      description="Internal commentary — visible to your workspace only."
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Tag className="size-3.5" /> Tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(tags.data ?? []).map((tag) => (
              <span key={tag.id} className="inline-flex">
                <Chip tone="info">
                  {tag.tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag.tag}`}
                    className="opacity-60 transition-opacity hover:opacity-100 disabled:hidden"
                    disabled={!canEdit}
                    onClick={() => dropTag.mutate(tag.id)}
                  >
                    <X className="size-3" />
                  </button>
                </Chip>
              </span>
            ))}
            {(tags.data ?? []).length === 0 && (
              <span className="text-xs text-muted-foreground">No tags applied yet.</span>
            )}
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (tagDraft.trim()) createTag.mutate(tagDraft);
            }}
          >
            <Input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              disabled={!canEdit}
              placeholder={canEdit ? "Add a tag…" : "Your role cannot edit tags"}
              className="h-8 bg-surface text-xs"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!canEdit || !tagDraft.trim() || createTag.isPending}
            >
              Add
            </Button>
          </form>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {(canEdit ? SUGGESTED_TAGS.filter((tag) => !applied.has(tag)) : []).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => createTag.mutate(tag)}
                className="transition-opacity hover:opacity-80"
              >
                <Chip tone="neutral">+ {tag}</Chip>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!canEdit}
            placeholder={
              canEdit
                ? "Capture an internal review comment…"
                : "Your role can read review notes but not add them."
            }
            className="min-h-20 bg-surface text-sm"
          />
          <Button
            size="sm"
            className="mt-2"
            disabled={!canEdit || !draft.trim() || createNote.isPending}
            onClick={() => createNote.mutate(draft.trim())}
          >
            {createNote.isPending ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : (
              <MessageSquarePlus className="mr-2 size-3.5" />
            )}
            Add note
          </Button>
        </div>

        <div className="space-y-3">
          {notes.isLoading && <p className="text-xs text-muted-foreground">Loading notes…</p>}
          {!notes.isLoading && (notes.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">
              No review notes yet for this conversation.
            </p>
          )}
          {(notes.data ?? []).map((note) => (
            <div key={note.id} className="rounded-lg border border-border bg-surface/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">{note.author_name ?? "Reviewer"}</p>
                <span className="text-[11px] text-muted-foreground">
                  {formatDate(note.created_at)}
                </span>
              </div>
              {editingId === note.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    className="min-h-16 bg-surface text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!editingBody.trim() || editNote.isPending}
                      onClick={() => editNote.mutate({ id: note.id, body: editingBody.trim() })}
                    >
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{note.body}</p>
                  <div className="mt-2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditingBody(note.body);
                      }}
                    >
                      <Pencil className="mr-1 size-3" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-destructive"
                      onClick={() => removeNote.mutate(note.id)}
                    >
                      <Trash2 className="mr-1 size-3" /> Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
