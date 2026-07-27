import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  AudioLines,
  BadgeCheck,
  Bot,
  Cctv,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Filter,
  Gauge,
  GraduationCap,
  Languages as LanguagesIcon,
  ListChecks,
  Play,
  Highlighter,
  ScanFace,
  ShieldCheck,
  Siren,
  SmilePlus,
  Sparkles,
  Store,
  Users2,
  Video,
  Waves,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/common/Primitives";
import {
  Chip,
  ConversationStatusBadge,
  EMOTION_TONE,
  LanguageBadge,
  RiskBadge,
  SentimentBadge,
  languageName,
} from "@/components/conversationiq/Badges";
import { AlertReviewPanel } from "@/components/conversationiq/AlertReviewPanel";
import { ReviewNotesPanel } from "@/components/conversationiq/ReviewNotesPanel";
import { iqConversationQuery } from "@/features/conversationiq/queries";
import { transcriptAnchorsQuery } from "@/features/conversationiq/anchors";
import {
  applyRedactions,
  byTranscript,
  createRedaction,
  deleteRedaction,
  redactionsQuery,
} from "@/features/conversationiq/redaction";
import { useIqAccess } from "@/features/conversationiq/access";
import {
  TranscriptAnchorPanel,
  type AnchorDraft,
} from "@/components/conversationiq/TranscriptAnchorPanel";
import { camerasQuery, outletsQuery } from "@/features/platform/queries";
import { formatDate, formatDuration, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/conversationiq/$conversationId")({
  head: () => ({
    meta: [
      { title: "Conversation Viewer — ConversationIQ™ | AegisIQ CX" },
      {
        name: "description",
        content:
          "Full transcript, AI summary, sentiment, risk, keywords and timeline for a single captured customer conversation.",
      },
      { property: "og:title", content: "Conversation Viewer — ConversationIQ™" },
      {
        property: "og:description",
        content: "Transcript, AI summary and conversation intelligence in one workspace.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConversationViewer,
});

const FUTURE_WIDGETS = [
  { label: "Voice Stress Analysis", icon: Waves },
  { label: "Speaker Diarisation", icon: Users2 },
  { label: "Behaviour Analysis", icon: ScanFace },
  { label: "Compliance Score", icon: ShieldCheck },
  { label: "Customer Satisfaction Score", icon: SmilePlus },
  { label: "Training Recommendation", icon: GraduationCap },
];

function offsetLabel(ms: number) {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)
    .toString()
    .padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

/** Wraps every saved anchor quote found in an utterance with a highlight mark. */
function renderHighlighted(content: string, quotes: string[]) {
  const matches = quotes.filter((quote) => quote && content.includes(quote));
  if (matches.length === 0) return content;
  const longest = [...matches].sort((a, b) => b.length - a.length);
  let parts: (string | { mark: string })[] = [content];
  for (const quote of longest) {
    parts = parts.flatMap((part) => {
      if (typeof part !== "string" || !part.includes(quote)) return [part];
      const segments = part.split(quote);
      return segments.flatMap((segment, index) =>
        index === 0 ? [segment] : [{ mark: quote }, segment],
      );
    });
  }
  return parts.map((part, index) =>
    typeof part === "string" ? (
      <span key={index}>{part}</span>
    ) : (
      <mark key={index} className="rounded bg-primary/25 px-0.5 text-foreground">
        {part.mark}
      </mark>
    ),
  );
}

function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Store;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </span>
      <span className="text-right text-xs font-medium">{children}</span>
    </div>
  );
}

function ConversationViewer() {
  const { conversationId } = Route.useParams();
  const queryClient = useQueryClient();
  const detail = useQuery(iqConversationQuery(conversationId));
  const outlets = useQuery(outletsQuery);
  const cameras = useQuery(camerasQuery);
  const [speakerFilter, setSpeakerFilter] = useState<Set<string>>(new Set());
  const access = useIqAccess();
  const canViewTranscripts = access.can("viewTranscripts");
  const [anchorDraft, setAnchorDraft] = useState<AnchorDraft | null>(null);
  const anchors = useQuery(transcriptAnchorsQuery(conversationId));
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const transcriptRefs = useRef(new Map<string, HTMLDivElement>());
  const redactions = useQuery(redactionsQuery(conversationId));
  const canManageRedactions = access.can("manageRedactions");
  const canRevealRedactions = access.can("revealRedactions");
  const [revealed, setRevealed] = useState(false);
  const reveal = canRevealRedactions && revealed;
  const redactionsByLine = useMemo(() => byTranscript(redactions.data ?? []), [redactions.data]);

  /** Masks the sensitive ranges saved against an utterance. */
  function displayContent(lineId: string, content: string) {
    return applyRedactions(content, redactionsByLine.get(lineId) ?? [], reveal);
  }

  /** Saves the reviewer's current text selection as a redacted range. */
  async function redactSelection(line: { id: string; content: string }) {
    const selection = window.getSelection()?.toString() ?? "";
    const snippet = selection.trim();
    if (!snippet || !line.content.includes(snippet)) {
      toast.error("Select the sensitive text inside this utterance first.");
      return;
    }
    const start = line.content.indexOf(snippet);
    try {
      await createRedaction({
        conversationId,
        transcriptId: line.id,
        startOffset: start,
        endOffset: start + snippet.length,
        category: "pii",
        label: "Redacted",
        originalSnippet: snippet,
        reason: "Marked sensitive during review",
      });
      await queryClient.invalidateQueries({ queryKey: ["iq", "redactions"] });
      toast.success("Segment redacted");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function liftRedaction(id: string) {
    try {
      await deleteRedaction(id);
      await queryClient.invalidateQueries({ queryKey: ["iq", "redactions"] });
      toast.success("Redaction lifted");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const allTranscripts = useMemo(() => detail.data?.transcripts ?? [], [detail.data]);
  const speakerStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of allTranscripts)
      counts.set(line.speaker, (counts.get(line.speaker) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [allTranscripts]);
  const visibleTranscripts = useMemo(
    () =>
      speakerFilter.size === 0
        ? allTranscripts
        : allTranscripts.filter((line) => speakerFilter.has(line.speaker.trim().toLowerCase())),
    [allTranscripts, speakerFilter],
  );

  /** Quotes to highlight inside each utterance, keyed by transcript row. */
  const anchorQuotes = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const anchor of anchors.data ?? []) {
      if (!anchor.transcript_id) continue;
      const list = map.get(anchor.transcript_id) ?? [];
      list.push(anchor.quote);
      map.set(anchor.transcript_id, list);
    }
    return map;
  }, [anchors.data]);

  /**
   * Sends the transcript to a saved anchor: isolates its speaker, scrolls the
   * matching utterance into view and flashes it so the reviewer sees the
   * exact moment the note refers to.
   */
  function jumpToAnchor(anchor: {
    id: string;
    speaker: string;
    transcript_id: string | null;
    start_ms: number;
  }) {
    const key = anchor.speaker.trim().toLowerCase();
    setSpeakerFilter((prev) => (prev.size === 0 || prev.has(key) ? prev : new Set([key])));
    setActiveAnchorId(anchor.id);
    const targetId =
      anchor.transcript_id ??
      allTranscripts
        .slice()
        .sort(
          (a, b) => Math.abs(a.start_ms - anchor.start_ms) - Math.abs(b.start_ms - anchor.start_ms),
        )[0]?.id;
    window.setTimeout(() => {
      const node = targetId ? transcriptRefs.current.get(targetId) : undefined;
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    window.setTimeout(() => setActiveAnchorId(null), 2600);
  }

  function toggleSpeaker(speaker: string) {
    setSpeakerFilter((prev) => {
      const next = new Set(prev);
      if (next.has(speaker)) next.delete(speaker);
      else next.add(speaker);
      return next;
    });
  }

  if (detail.isLoading) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Skeleton className="h-[70vh] w-full rounded-xl" />
        <Skeleton className="h-[70vh] w-full rounded-xl" />
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <Panel
        title="Conversation unavailable"
        description="This record is not visible in your workspace."
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/conversationiq">
            <ArrowLeft className="mr-2 size-4" /> Back to ConversationIQ™
          </Link>
        </Button>
      </Panel>
    );
  }

  const { conversation, transcripts, summary, keywords, events, alerts } = detail.data;
  const outlet = outlets.data?.find((o) => o.id === conversation.outlet_id);
  const camera = cameras.data?.find((c) => c.id === conversation.camera_id);
  const speakers = Array.from(new Set(transcripts.map((t) => t.speaker)));
  const sentimentPct = Math.round(((conversation.sentiment_score + 1) / 2) * 100);
  const riskPct = { low: 20, medium: 58, high: 92 }[conversation.risk_level] ?? 20;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/conversationiq">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-mono text-lg font-semibold tracking-tight">
              {conversation.reference}
            </h1>
            <p className="text-xs text-muted-foreground">
              {formatDate(conversation.started_at)} · {outlet?.name ?? "Unassigned outlet"} ·{" "}
              {conversation.topic ?? "General interaction"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConversationStatusBadge value={conversation.status} />
          <RiskBadge value={conversation.risk_level} />
          <SentimentBadge value={conversation.sentiment} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(conversation.reference);
              toast.success("Conversation reference copied");
            }}
          >
            <Copy className="mr-2 size-4" /> Copy ID
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* LEFT — capture, metadata, transcript, timeline */}
        <div className="space-y-6">
          <div className="panel overflow-hidden">
            <div className="relative grid aspect-video place-items-center bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_70%)]">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <span className="grid size-14 place-items-center rounded-full border border-border bg-surface/80">
                  <Video className="size-6" />
                </span>
                <p className="text-xs">Video playback placeholder · CCTV stream not connected</p>
              </div>
              <span className="absolute left-3 top-3">
                <Chip tone="neutral">
                  <Cctv className="size-3" /> {camera?.name ?? "Camera unassigned"}
                </Chip>
              </span>
            </div>
            <div className="flex items-center gap-3 border-t border-border px-4 py-3">
              <Button variant="outline" size="icon" className="size-9" disabled>
                <Play className="size-4" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <AudioLines className="size-3.5" /> Audio track placeholder
                </div>
                <Progress value={0} className="mt-2 h-1.5" />
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                00:00 / {offsetLabel(conversation.duration_seconds * 1000)}
              </span>
            </div>
          </div>

          <Panel title="Conversation metadata" description="Capture context recorded at ingestion.">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <MetaRow icon={Store} label="Outlet">
                {outlet?.name ?? "—"}
              </MetaRow>
              <MetaRow icon={Cctv} label="Camera">
                {camera?.name ?? "—"}
              </MetaRow>
              <MetaRow icon={Clock3} label="Duration">
                {formatDuration(conversation.duration_seconds)}
              </MetaRow>
              <MetaRow icon={LanguagesIcon} label="Language">
                {languageName(conversation.language_code)}
              </MetaRow>
              <MetaRow icon={Clock3} label="Date">
                {formatDate(conversation.started_at)}
              </MetaRow>
              <MetaRow icon={Users2} label="Detected speakers">
                {speakers.length > 0 ? speakers.map(titleCase).join(", ") : "—"}
              </MetaRow>
              <MetaRow icon={SmilePlus} label="Sentiment">
                {titleCase(conversation.sentiment)}
              </MetaRow>
              <MetaRow icon={ShieldCheck} label="Risk">
                {titleCase(conversation.risk_level)}
              </MetaRow>
            </div>
          </Panel>

          {!canViewTranscripts && (
            <Panel
              title="Transcript"
              description="Restricted — your role cannot view conversation transcripts."
            >
              <p className="py-8 text-center text-sm text-muted-foreground">
                Ask a workspace administrator for a supervisor or manager role to read transcripts
                and saved anchors.
              </p>
            </Panel>
          )}

          {canViewTranscripts && (
            <Panel
              title="Transcript"
              description={`${visibleTranscripts.length} of ${transcripts.length} utterances · diarised by speaker${
                (redactions.data ?? []).length > 0
                  ? ` · ${(redactions.data ?? []).length} redacted segment(s)`
                  : ""
              }`}
              actions={
                canRevealRedactions && (redactions.data ?? []).length > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => setRevealed((v) => !v)}>
                    {reveal ? (
                      <>
                        <EyeOff className="mr-1.5 size-3.5" /> Hide redacted
                      </>
                    ) : (
                      <>
                        <Eye className="mr-1.5 size-3.5" /> Reveal redacted
                      </>
                    )}
                  </Button>
                ) : undefined
              }
            >
              <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3">
                <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  <Filter className="size-3" /> Speakers
                </span>
                <button
                  type="button"
                  onClick={() => setSpeakerFilter(new Set())}
                  className="transition-opacity hover:opacity-80"
                >
                  <Chip tone={speakerFilter.size === 0 ? "info" : "neutral"}>
                    All · {transcripts.length}
                  </Chip>
                </button>
                {speakerStats.map(([speaker, count]) => (
                  <button
                    key={speaker}
                    type="button"
                    onClick={() => toggleSpeaker(speaker)}
                    className="transition-opacity hover:opacity-80"
                  >
                    <Chip
                      tone={speakerFilter.has(speaker) ? "info" : "neutral"}
                      className={cn(
                        speakerFilter.size > 0 && !speakerFilter.has(speaker) && "opacity-50",
                      )}
                    >
                      <Users2 className="size-3" />
                      {titleCase(speaker)} · {count}
                    </Chip>
                  </button>
                ))}
              </div>
              <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                {visibleTranscripts.map((line, index) => {
                  const isCustomer = line.speaker.toLowerCase().includes("customer");
                  const isActive = (anchors.data ?? []).some(
                    (anchor) => anchor.id === activeAnchorId && anchor.transcript_id === line.id,
                  );
                  return (
                    <motion.div
                      key={line.id}
                      ref={(node) => {
                        if (node) transcriptRefs.current.set(line.id, node);
                        else transcriptRefs.current.delete(line.id);
                      }}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.3) }}
                      className={cn("group flex", isCustomer ? "justify-start" : "justify-end")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl border px-3.5 py-2.5 transition-shadow",
                          isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                          isCustomer
                            ? "rounded-tl-sm border-border bg-surface"
                            : "rounded-tr-sm border-primary/25 bg-primary/10",
                        )}
                      >
                        <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          <span className="font-semibold text-foreground/80">
                            {titleCase(line.speaker)}
                          </span>
                          <span className="font-mono">{offsetLabel(line.start_ms)}</span>
                          <span>{languageName(line.language_code)}</span>
                          <span className="flex items-center gap-1">
                            <BadgeCheck className="size-3" />
                            {Math.round(Number(line.confidence) * 100)}%
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">
                          {renderHighlighted(
                            displayContent(line.id, line.content),
                            anchorQuotes.get(line.id) ?? [],
                          )}
                        </p>
                        <div className="mt-1.5 hidden gap-1 group-hover:flex">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => {
                              void navigator.clipboard.writeText(
                                displayContent(line.id, line.content),
                              );
                              toast.success("Utterance copied");
                            }}
                          >
                            <Copy className="mr-1 size-3" /> Copy
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => {
                              const selection = window.getSelection()?.toString().trim() ?? "";
                              const quote =
                                selection && line.content.includes(selection)
                                  ? selection
                                  : line.content;
                              setAnchorDraft({
                                transcriptId: line.id,
                                speaker: line.speaker,
                                startMs: line.start_ms,
                                endMs: line.end_ms,
                                quote,
                              });
                              toast.info("Highlight ready — add a note or label to save it");
                            }}
                          >
                            <Highlighter className="mr-1 size-3" /> Anchor
                          </Button>
                          {canManageRedactions && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => void redactSelection(line)}
                            >
                              <EyeOff className="mr-1 size-3" /> Redact
                            </Button>
                          )}
                          {canManageRedactions &&
                            (redactionsByLine.get(line.id) ?? []).map((item) => (
                              <Button
                                key={item.id}
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => void liftRedaction(item.id)}
                              >
                                <Eye className="mr-1 size-3" /> Lift {item.label}
                              </Button>
                            ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {visibleTranscripts.length === 0 && (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {transcripts.length === 0
                      ? "No transcript captured for this conversation."
                      : "No utterances from the selected speakers."}
                  </p>
                )}
              </div>
            </Panel>
          )}

          {canViewTranscripts && (
            <TranscriptAnchorPanel
              conversationId={conversationId}
              draft={anchorDraft}
              onClearDraft={() => setAnchorDraft(null)}
              onJump={jumpToAnchor}
            />
          )}

          <Panel
            title="Conversation timeline"
            description="Detected milestones across the interaction."
          >
            <ol className="relative space-y-4 border-l border-border pl-5">
              {events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[1.42rem] top-1.5 size-2.5 rounded-full border border-primary/50 bg-primary/40" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{event.label}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {offsetLabel(event.offset_ms)}
                    </span>
                  </div>
                  {event.detail && <p className="text-xs text-muted-foreground">{event.detail}</p>}
                </li>
              ))}
              {events.length === 0 && (
                <li className="text-sm text-muted-foreground">No timeline events recorded.</li>
              )}
            </ol>
          </Panel>
        </div>

        {/* RIGHT — AI intelligence */}
        <div className="space-y-6">
          <Panel
            title="AI summary"
            description={summary ? `Generated by ${summary.model}` : "Awaiting generation"}
          >
            {summary ? (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{summary.summary}</p>
                {summary.key_points.length > 0 && (
                  <ul className="space-y-1.5">
                    {summary.key_points.map((point) => (
                      <li key={point} className="flex gap-2 text-xs text-muted-foreground">
                        <ListChecks className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {summary.intent && <Chip tone="info">Intent · {summary.intent}</Chip>}
                  <Chip tone={summary.resolution_status === "resolved" ? "positive" : "warning"}>
                    {titleCase(summary.resolution_status)}
                  </Chip>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No summary has been generated for this conversation yet.
              </p>
            )}
          </Panel>

          <Panel
            title="Conversation intelligence"
            description="Sentiment, risk and emotion signals."
          >
            <div className="space-y-5">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Gauge className="size-3.5" /> Sentiment gauge
                  </span>
                  <span className="font-medium">{sentimentPct}%</span>
                </div>
                <Progress value={sentimentPct} className="h-2" />
                <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <span>Negative</span>
                  <span>Neutral</span>
                  <span>Positive</span>
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <ShieldCheck className="size-3.5" /> Risk meter
                  </span>
                  <span className="font-medium">{titleCase(conversation.risk_level)}</span>
                </div>
                <Progress value={riskPct} className="h-2" />
                <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <span>Low</span>
                  <span>Medium</span>
                  <span>High</span>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Detected emotion</p>
                <div className="flex flex-wrap gap-2">
                  {(["satisfied", "happy", "confused", "frustrated", "angry"] as const).map(
                    (emotion) => (
                      <Chip
                        key={emotion}
                        tone={conversation.emotion === emotion ? EMOTION_TONE[emotion] : "neutral"}
                        className={cn(conversation.emotion !== emotion && "opacity-45")}
                      >
                        {titleCase(emotion)}
                      </Chip>
                    ),
                  )}
                </div>
              </div>
              {alerts.length > 0 && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                  <p className="flex items-center gap-2 text-xs font-medium text-destructive">
                    <Siren className="size-3.5" /> {alerts.length} linked alert
                    {alerts.length > 1 ? "s" : ""}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {alerts.map((alert) => (
                      <li key={alert.id} className="text-xs text-muted-foreground">
                        {alert.title} · {titleCase(alert.severity)} · {titleCase(alert.status)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Panel>

          <AlertReviewPanel alerts={alerts} conversationId={conversation.id} />

          <ReviewNotesPanel conversationId={conversation.id} />

          <Panel
            title="Detected keywords"
            description="Terms matched against the tenant keyword library."
          >
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <Chip
                  key={keyword.id}
                  tone="info"
                  title={`${keyword.category} · ${Math.round(Number(keyword.confidence) * 100)}% confidence`}
                >
                  {keyword.keyword}
                  <span className="opacity-60">
                    {Math.round(Number(keyword.confidence) * 100)}%
                  </span>
                </Chip>
              ))}
              {keywords.length === 0 && (
                <p className="text-sm text-muted-foreground">No keywords detected.</p>
              )}
            </div>
          </Panel>

          <Panel title="Detected language" description="Primary and secondary language detection.">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Primary language</span>
                <LanguageBadge code={conversation.language_code} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Secondary language</span>
                {conversation.secondary_language_code ? (
                  <LanguageBadge code={conversation.secondary_language_code} />
                ) : (
                  <span className="text-xs">None detected</span>
                )}
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Detection confidence</span>
                  <span className="font-medium">
                    {Math.round(Number(conversation.language_confidence) * 100)}%
                  </span>
                </div>
                <Progress value={Number(conversation.language_confidence) * 100} className="h-2" />
              </div>
            </div>
          </Panel>

          <Panel
            title="Future AI widgets"
            description="Architecture prepared — models are not connected in this release."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {FUTURE_WIDGETS.map((widget) => (
                <div
                  key={widget.label}
                  className="rounded-lg border border-dashed border-border bg-surface/40 p-3"
                >
                  <widget.icon className="size-4 text-muted-foreground" />
                  <p className="mt-2 text-xs font-medium">{widget.label}</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    <Sparkles className="size-3" /> Coming soon
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Bot className="size-3.5" /> Inference outputs will populate these cards without UI
              changes.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
