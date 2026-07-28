import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { EmptyState, ErrorState, LoadingState, StatusPill } from "@/components/common/Primitives";
import { iqConversationQuery } from "@/features/conversationiq/queries";
import type { IqTranscript } from "@/features/conversationiq/queries";
import { cn } from "@/lib/utils";

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * One-click replay of the conversation that produced an alert.
 *
 * The transcript timeline is the playback source of truth: the playhead scrubs
 * the conversation, auto-scrolls the active utterance and marks the moment the
 * alert fired so a triager can hear/read the trigger without leaving triage.
 */
export function ConversationReplayPanel({
  conversationId,
  alertTriggeredAt,
}: {
  conversationId: string;
  alertTriggeredAt: string;
}) {
  const detail = useQuery(iqConversationQuery(conversationId));
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const listRef = useRef<HTMLDivElement | null>(null);

  const transcripts = useMemo<IqTranscript[]>(() => detail.data?.transcripts ?? [], [detail.data]);
  const events = detail.data?.events ?? [];
  const conversation = detail.data?.conversation;

  const durationMs = useMemo(() => {
    const fromTranscripts = transcripts.reduce((max, t) => Math.max(max, t.end_ms), 0);
    const fromDuration = (conversation?.duration_seconds ?? 0) * 1000;
    return Math.max(fromTranscripts, fromDuration, 1000);
  }, [transcripts, conversation]);

  /** Offset within the conversation at which the alert fired. */
  const alertOffsetMs = useMemo(() => {
    if (!conversation) return 0;
    const started = new Date(conversation.started_at).getTime();
    const fired = new Date(alertTriggeredAt).getTime();
    return Math.min(Math.max(fired - started, 0), durationMs);
  }, [conversation, alertTriggeredAt, durationMs]);

  // Advance the playhead while playing.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setPlayhead((prev) => {
        const next = prev + 250 * speed;
        if (next >= durationMs) {
          setPlaying(false);
          return durationMs;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [playing, speed, durationMs]);

  const activeIndex = useMemo(() => {
    if (transcripts.length === 0) return -1;
    const hit = transcripts.findIndex((t) => playhead >= t.start_ms && playhead < t.end_ms);
    if (hit >= 0) return hit;
    let last = -1;
    transcripts.forEach((t, i) => {
      if (t.start_ms <= playhead) last = i;
    });
    return last;
  }, [transcripts, playhead]);

  // Keep the spoken line in view as playback moves.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(`[data-line="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  if (detail.isPending) return <LoadingState rows={4} />;
  if (detail.error) {
    return <ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} />;
  }
  if (transcripts.length === 0) {
    return (
      <EmptyState
        title="No transcript captured"
        description="This alert was raised from telemetry rather than a recorded conversation."
      />
    );
  }

  const jump = (ms: number) => {
    setPlayhead(Math.min(Math.max(ms, 0), durationMs));
  };

  return (
    <div className="rounded-lg border border-border bg-surface/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{conversation?.reference}</p>
          <p className="text-[11px] text-muted-foreground">
            {transcripts.length} utterances · {clock(durationMs)} · timeline replay
          </p>
        </div>
        {conversation && (
          <Button size="sm" variant="ghost" asChild>
            <Link
              to="/conversationiq/$conversationId"
              params={{ conversationId: conversation.id }}
            >
              <ExternalLink className="mr-2 size-3.5" /> Full record
            </Link>
          </Button>
        )}
      </div>

      <div className="space-y-3 px-3 py-3">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label="Back 10 seconds"
            onClick={() => jump(playhead - 10_000)}
          >
            <SkipBack className="size-4" />
          </Button>
          <Button
            size="icon"
            className="size-9"
            aria-label={playing ? "Pause replay" : "Play replay"}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label="Forward 10 seconds"
            onClick={() => jump(playhead + 10_000)}
          >
            <SkipForward className="size-4" />
          </Button>
          <span className="ml-1 text-[11px] tabular-nums text-muted-foreground">
            {clock(playhead)} / {clock(durationMs)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {[1, 1.5, 2].map((rate) => (
              <Button
                key={rate}
                size="sm"
                variant={speed === rate ? "secondary" : "ghost"}
                className="h-7 px-2 text-[11px]"
                onClick={() => setSpeed(rate)}
              >
                {rate}×
              </Button>
            ))}
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label="Restart replay"
              onClick={() => {
                setPlayhead(0);
                setPlaying(false);
              }}
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Slider
            value={[playhead]}
            max={durationMs}
            step={250}
            onValueChange={([v]) => jump(v)}
            aria-label="Replay position"
          />
          {/* Trigger marker */}
          <span
            className="pointer-events-none absolute -top-1 h-4 w-0.5 rounded bg-destructive"
            style={{ left: `${(alertOffsetMs / durationMs) * 100}%` }}
            title="Alert triggered here"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => {
              jump(alertOffsetMs);
              setPlaying(true);
            }}
          >
            Jump to trigger · {clock(alertOffsetMs)}
          </Button>
          {events.slice(0, 6).map((event) => (
            <Button
              key={event.id}
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={() => jump(event.offset_ms)}
            >
              {event.label} · {clock(event.offset_ms)}
            </Button>
          ))}
        </div>

        <div
          ref={listRef}
          className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background/40 p-2"
        >
          {transcripts.map((line, index) => {
            const active = index === activeIndex;
            const nearTrigger =
              alertOffsetMs >= line.start_ms && alertOffsetMs < Math.max(line.end_ms, line.start_ms + 1);
            return (
              <button
                key={line.id}
                type="button"
                data-line={index}
                onClick={() => jump(line.start_ms)}
                className={cn(
                  "w-full rounded-md px-2.5 py-2 text-left transition-colors",
                  active ? "bg-primary/12 ring-1 ring-primary/30" : "hover:bg-muted/40",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium capitalize">{line.speaker}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {clock(line.start_ms)}
                  </span>
                  {nearTrigger && <StatusPill label="trigger" tone="negative" />}
                </div>
                <p
                  className={cn(
                    "mt-0.5 text-xs",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {line.content}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
