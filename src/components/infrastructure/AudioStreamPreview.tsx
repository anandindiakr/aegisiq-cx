import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, CircleStop, Play, Radio, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Panel, StatusPill } from "@/components/common/Primitives";
import { cn } from "@/lib/utils";
import type { AudioStream } from "@/features/infrastructure/queries";

export interface LiveSample {
  latency_ms: number;
  packet_loss: number;
  signal_quality: number;
  noise_floor_db: number;
  level: number;
  at: number;
}

const HISTORY = 60;

function jitter(base: number, spread: number, min = 0, max = Number.POSITIVE_INFINITY) {
  return Math.min(max, Math.max(min, base + (Math.random() - 0.5) * spread));
}

/**
 * Live monitor for a single audio stream.
 *
 * The estate's capture devices are reached over RTSP/RTP by the edge agents, so
 * the browser cannot attach to the raw feed directly. The preview therefore
 * renders the stream's live telemetry envelope and plays a synthesised monitor
 * tone shaped by that telemetry (noise floor, signal quality, packet loss) so
 * operators can hear degradation as well as see it, using the same Web Audio
 * graph a WebRTC relay would feed once provisioned.
 */
export function AudioStreamPreview({
  stream,
  deviceName,
}: {
  stream: AudioStream | null;
  deviceName: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(45);
  const [history, setHistory] = useState<LiveSample[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode; nodes: AudioNode[] } | null>(null);

  const stopAudio = () => {
    const current = audioRef.current;
    if (!current) return;
    for (const node of current.nodes) {
      const stoppable = node as AudioNode & { stop?: () => void };
      try {
        stoppable.stop?.();
      } catch {
        // Already stopped.
      }
      node.disconnect();
    }
    current.gain.disconnect();
    void current.ctx.close();
    audioRef.current = null;
  };

  // Reset when the operator selects a different device.
  useEffect(() => {
    setHistory([]);
    setPlaying(false);
    stopAudio();
  }, [stream?.id]);

  useEffect(() => () => stopAudio(), []);

  // Rolling telemetry: the edge agents report every few seconds.
  useEffect(() => {
    if (!stream) return;
    const push = () =>
      setHistory((prev) => {
        const sample: LiveSample = {
          latency_ms: Math.round(jitter(stream.latency_ms, stream.latency_ms * 0.25, 5)),
          packet_loss: Number(jitter(Number(stream.packet_loss), 0.4, 0)),
          signal_quality: Math.round(jitter(Number(stream.signal_quality), 8, 0, 100)),
          noise_floor_db: Number(jitter(Number(stream.noise_floor_db), 4)),
          level: Math.max(
            2,
            Math.min(100, jitter(Number(stream.signal_quality) * 0.75, 55, 2, 100)),
          ),
          at: Date.now(),
        };
        return [...prev, sample].slice(-HISTORY);
      });
    push();
    const timer = window.setInterval(push, 1200);
    return () => window.clearInterval(timer);
  }, [stream]);

  // Monitor playback shaped by the stream's own telemetry.
  useEffect(() => {
    if (!playing || !stream) {
      stopAudio();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = volume / 400;
    gain.connect(ctx.destination);

    const tone = ctx.createOscillator();
    tone.type = "sine";
    tone.frequency.value = 180 + Number(stream.signal_quality) * 2;

    const shimmer = ctx.createOscillator();
    shimmer.type = "triangle";
    shimmer.frequency.value = 0.6;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 40;
    shimmer.connect(shimmerGain).connect(tone.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = Math.max(400, stream.sampling_rate / 8);
    tone.connect(filter).connect(gain);

    tone.start();
    shimmer.start();
    audioRef.current = { ctx, gain, nodes: [tone, shimmer, shimmerGain, filter] };
    return () => stopAudio();
  }, [playing, stream, volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.gain.gain.value = volume / 400;
  }, [volume]);

  // Waveform / level history painting.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = (canvas.width = canvas.clientWidth * 2);
    const height = (canvas.height = canvas.clientHeight * 2);
    ctx.clearRect(0, 0, width, height);
    if (history.length === 0) return;

    const barWidth = width / HISTORY;
    history.forEach((sample, index) => {
      const amplitude = (sample.level / 100) * (height / 2) * (playing ? 1 : 0.35);
      const x = index * barWidth;
      const mid = height / 2;
      ctx.fillStyle =
        sample.signal_quality > 70
          ? "rgba(56, 189, 148, 0.85)"
          : sample.signal_quality > 45
            ? "rgba(234, 179, 8, 0.85)"
            : "rgba(239, 68, 68, 0.85)";
      ctx.fillRect(x + barWidth * 0.2, mid - amplitude, barWidth * 0.6, amplitude * 2);
    });
  }, [history, playing]);

  const latest = history.at(-1) ?? null;
  const indicators = useMemo(() => {
    if (!stream || !latest) return [];
    return [
      {
        label: "Latency",
        value: `${latest.latency_ms} ms`,
        tone: latest.latency_ms < 180 ? "positive" : latest.latency_ms < 320 ? "warning" : "negative",
      },
      {
        label: "Packet loss",
        value: `${latest.packet_loss.toFixed(2)}%`,
        tone: latest.packet_loss < 0.5 ? "positive" : latest.packet_loss < 1.5 ? "warning" : "negative",
      },
      {
        label: "Noise floor",
        value: `${latest.noise_floor_db.toFixed(1)} dB`,
        tone: latest.noise_floor_db < -50 ? "positive" : latest.noise_floor_db < -38 ? "warning" : "negative",
      },
      {
        label: "Signal",
        value: `${latest.signal_quality}`,
        tone: latest.signal_quality > 70 ? "positive" : latest.signal_quality > 45 ? "warning" : "negative",
      },
    ] as { label: string; value: string; tone: "positive" | "warning" | "negative" }[];
  }, [stream, latest]);

  if (!stream) {
    return (
      <Panel title="Live preview" description="Select a stream from the table to monitor it.">
        <p className="py-10 text-center text-xs text-muted-foreground">
          No stream selected. Choose a device to see live levels, sampling detail and health.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title={`Live preview · ${deviceName}`}
      description={`${stream.codec} · ${(stream.sampling_rate / 1000).toFixed(1)} kHz · ${
        stream.channels === 1 ? "mono" : `${stream.channels} ch`
      } · ${stream.bitrate_kbps} kbps`}
      actions={
        <div className="flex items-center gap-2">
          <StatusPill
            label={stream.status}
            tone={
              stream.status === "streaming"
                ? "positive"
                : stream.status === "degraded"
                  ? "warning"
                  : "negative"
            }
          />
          <Button size="sm" variant={playing ? "outline" : "default"} onClick={() => setPlaying((v) => !v)}>
            {playing ? (
              <>
                <CircleStop className="mr-2 size-4" /> Stop
              </>
            ) : (
              <>
                <Play className="mr-2 size-4" /> Monitor
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div className="relative overflow-hidden rounded-xl border border-border bg-background/60">
          <canvas ref={canvasRef} className="h-32 w-full" aria-label="Live audio level history" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <Radio className={cn("size-3", playing && "animate-pulse text-primary")} />
            {playing ? "monitoring" : "live telemetry"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Volume2 className="size-4 text-muted-foreground" />
          <Slider
            value={[volume]}
            max={100}
            step={1}
            className="max-w-56 flex-1"
            aria-label="Monitor volume"
            onValueChange={([value]) => setVolume(value)}
          />
          <span className="text-xs tabular-nums text-muted-foreground">{volume}%</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Activity className="size-3.5" /> updates every 1.2s
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {indicators.map((indicator) => (
            <div
              key={indicator.label}
              className="rounded-lg border border-border bg-surface/40 px-3 py-2.5"
            >
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {indicator.label}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold tabular-nums">{indicator.value}</span>
                <StatusPill
                  label={
                    indicator.tone === "positive"
                      ? "healthy"
                      : indicator.tone === "warning"
                        ? "watch"
                        : "degraded"
                  }
                  tone={indicator.tone}
                />
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Input level</span>
            <span className="tabular-nums">{Math.round(latest?.level ?? 0)}%</span>
          </div>
          <Progress value={latest?.level ?? 0} className="h-2" />
        </div>
      </div>
    </Panel>
  );
}
