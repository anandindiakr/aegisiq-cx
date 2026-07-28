/**
 * Structured answer card for Aegis Copilot™ responses.
 */
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, HelpCircle, Loader2, Sparkles, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CopilotResponse } from "@/features/copilot/types";

function Inline({ text }: { text: string }) {
  // Minimal markdown: **bold** segments only, so answers stay render-safe.
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{part.replace(/^[-*]\s*/, "")}</span>
        ),
      )}
    </>
  );
}

function MiniChart({ points }: { points: { label: string; value: number }[] }) {
  const max = Math.max(...points.map((p) => Math.abs(p.value)), 1);
  return (
    <div className="flex h-24 items-end gap-1.5">
      {points.map((point) => (
        <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-primary/70"
            style={{ height: `${Math.max(4, (Math.abs(point.value) / max) * 72)}px` }}
            title={`${point.label}: ${point.value}`}
          />
          <span className="w-full truncate text-center text-[9px] text-muted-foreground">
            {point.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CopilotResponseCard({
  response,
  onFollowUp,
  busy = false,
}: {
  response: CopilotResponse;
  onFollowUp?: (command: string) => void;
  busy?: boolean;
}) {
  const toneRing =
    response.tone === "danger"
      ? "border-destructive/40"
      : response.tone === "warning"
        ? "border-warning/40"
        : "border-border";

  return (
    <article className={cn("rounded-xl border bg-surface/70 p-3.5", toneRing)}>
      <header className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-primary/12 text-primary ring-1 ring-primary/25">
          {response.tone === "danger" ? (
            <AlertTriangle className="size-3.5" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight">{response.title}</h3>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {response.intent.replace(/_/g, " ")} · {response.outcome}
          </p>
        </div>
      </header>

      {response.progress && !response.progress.done && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" />
              {response.progress.label}
            </span>
            <span>{response.progress.percent}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${response.progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {response.metrics.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {response.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-border bg-background/60 p-2"
            >
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {metric.label}
              </p>
              <p
                className={cn(
                  "truncate text-sm font-semibold",
                  metric.tone === "danger" && "text-destructive",
                  metric.tone === "warning" && "text-warning",
                  metric.tone === "positive" && "text-success",
                )}
              >
                {metric.value}
              </p>
              {metric.hint && (
                <p className="truncate text-[10px] text-muted-foreground">{metric.hint}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {response.body.length > 0 && (
        <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          {response.body.map((line, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
              <span className="min-w-0">
                <Inline text={line} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {response.chart && response.chart.points.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-background/60 p-2.5">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            {response.chart.title}
          </p>
          <MiniChart points={response.chart.points} />
        </div>
      )}

      {response.deniedReason && (
        <Badge variant="outline" className="mt-3 border-destructive/40 text-destructive">
          {response.deniedReason}
        </Badge>
      )}

      {response.links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {response.links.map((link, index) => (
            <Button
              key={`${link.to}-${index}`}
              asChild
              size="sm"
              variant="outline"
              className="h-8 text-xs"
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link to={link.to as any} params={link.params as any} search={link.search as any}>
                {link.label}
                <ArrowUpRight className="ml-1 size-3" />
              </Link>
            </Button>
          ))}
        </div>
      )}

      {response.clarification && onFollowUp && (
        <div className="mt-3 rounded-lg border border-warning/40 bg-warning/5 p-2.5">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-foreground">
            <HelpCircle className="size-3.5 text-warning" />
            {response.clarification.question}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {response.clarification.options.map((option) => (
              <Button
                key={option.command}
                size="sm"
                variant="secondary"
                disabled={busy}
                className="h-8 text-xs"
                onClick={() => onFollowUp(option.command)}
                title={option.hint}
              >
                {option.label}
                {option.hint && (
                  <span className="ml-1 text-[10px] text-muted-foreground">{option.hint}</span>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      {response.followUps && response.followUps.length > 0 && onFollowUp && (
        <div className="mt-3 border-t border-border/60 pt-2.5">
          <p className="mb-1.5 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Wand2 className="size-3" /> Next
          </p>
          <div className="flex flex-wrap gap-1.5">
            {response.followUps.map((chip) => (
              <button
                key={chip.command}
                type="button"
                disabled={busy}
                title={chip.hint ?? chip.command}
                onClick={() => onFollowUp(chip.command)}
                className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
