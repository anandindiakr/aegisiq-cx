import {
  Angry,
  Frown,
  Meh,
  Smile,
  Laugh,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Languages as LanguagesIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";
import type {
  ConversationStatus,
  EmotionLabel,
  RiskLevel,
  SentimentLabel,
} from "@/features/conversationiq/queries";

/** Muted enterprise palette — green / amber / red only, no bright fills. */
const TONES = {
  positive: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  negative: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-border bg-muted/40 text-muted-foreground",
} as const;

type Tone = keyof typeof TONES;

export function Chip({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const SENTIMENT_META: Record<SentimentLabel, { tone: Tone; label: string; Icon: typeof Smile }> = {
  very_positive: { tone: "positive", label: "Very positive", Icon: Laugh },
  positive: { tone: "positive", label: "Positive", Icon: Smile },
  neutral: { tone: "neutral", label: "Neutral", Icon: Meh },
  negative: { tone: "warning", label: "Negative", Icon: Frown },
  very_negative: { tone: "negative", label: "Very negative", Icon: Angry },
};

export function SentimentBadge({ value }: { value: SentimentLabel }) {
  const meta = SENTIMENT_META[value] ?? SENTIMENT_META.neutral;
  return (
    <Chip tone={meta.tone}>
      <meta.Icon className="size-3" />
      {meta.label}
    </Chip>
  );
}

const RISK_META: Record<RiskLevel, { tone: Tone; Icon: typeof ShieldCheck }> = {
  low: { tone: "positive", Icon: ShieldCheck },
  medium: { tone: "warning", Icon: ShieldQuestion },
  high: { tone: "negative", Icon: ShieldAlert },
};

export function RiskBadge({ value }: { value: RiskLevel }) {
  const meta = RISK_META[value] ?? RISK_META.low;
  return (
    <Chip tone={meta.tone}>
      <meta.Icon className="size-3" />
      {titleCase(value)}
    </Chip>
  );
}

export const IQ_LANGUAGES: Record<string, string> = {
  en: "English",
  zh: "Chinese",
  ms: "Malay",
  ta: "Tamil",
  tl: "Tagalog",
};

export function languageName(code: string | null | undefined) {
  if (!code) return "—";
  return IQ_LANGUAGES[code] ?? code.toUpperCase();
}

export function LanguageBadge({ code }: { code: string | null | undefined }) {
  return (
    <Chip tone="info">
      <LanguagesIcon className="size-3" />
      {languageName(code)}
    </Chip>
  );
}

const STATUS_TONE: Record<ConversationStatus, Tone> = {
  new: "info",
  in_review: "warning",
  escalated: "negative",
  resolved: "positive",
  closed: "neutral",
};

export function ConversationStatusBadge({ value }: { value: ConversationStatus }) {
  return <Chip tone={STATUS_TONE[value] ?? "neutral"}>{titleCase(value)}</Chip>;
}

export const EMOTION_TONE: Record<EmotionLabel, Tone> = {
  satisfied: "positive",
  happy: "positive",
  neutral: "neutral",
  confused: "info",
  frustrated: "warning",
  angry: "negative",
};
