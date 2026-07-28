/**
 * Aegis Copilot™ dock.
 *
 * Mobile-first: a full-screen experience on phones, a floating glass panel on
 * desktop, with a minimise/restore pill that keeps the command history one tap
 * away.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bot,
  ChevronDown,
  FileBarChart,
  FileDown,
  History,
  Languages,
  LayoutDashboard,
  Loader2,
  MapPinned,
  MessagesSquare,
  Mic,
  MicOff,
  Send,
  Settings2,
  Siren,
  Sparkles,
  Store,
  Tags,
  Timer,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  CONVERSATION_COMMANDS,
  EXECUTIVE_COMMANDS,
  ROADMAP,
  type CopilotCommandCard,
} from "@/features/copilot/catalog";
import { rankCommands, toggleFavoriteCommand } from "@/features/copilot/preferences";
import { useCopilot } from "./CopilotProvider";
import { useCopilotVoice } from "./useCopilotVoice";
import { CopilotResponseCard } from "./CopilotResponseCard";

const ICONS: Record<CopilotCommandCard["icon"], typeof Sparkles> = {
  report: FileBarChart,
  alerts: Siren,
  regions: MapPinned,
  export: FileDown,
  outlets: Store,
  sentiment: BarChart3,
  language: Languages,
  keywords: Tags,
  queue: Timer,
  conversations: MessagesSquare,
  dashboard: LayoutDashboard,
};

function CommandGrid({
  cards,
  onRun,
  favourites,
  onFavourite,
}: {
  cards: CopilotCommandCard[];
  onRun: (phrase: string) => void;
  favourites: string[];
  onFavourite: (id: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {cards.map((card) => {
        const Icon = ICONS[card.icon];
        const isFavourite = favourites.includes(card.id);
        return (
          <div
            key={card.id}
            className="group rounded-xl border border-border bg-surface/70 p-3 text-left transition-colors hover:border-primary/40"
          >
            <button
              type="button"
              onClick={() => onRun(card.phrase)}
              className="flex w-full min-w-0 items-start gap-2.5 text-left"
            >
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/25">
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{card.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {card.description}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onFavourite(card.id)}
              className={cn(
                "mt-2 text-[10px] uppercase tracking-wider",
                isFavourite ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isFavourite ? "★ Favourite" : "☆ Add to favourites"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function CopilotDock() {
  const copilot = useCopilot();
  const {
    open,
    minimised,
    messages,
    busy,
    context,
    preferences,
    run,
    setOpen,
    minimise,
    restore,
    clear,
  } = copilot;

  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState("ask");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const voice = useCopilotVoice({
    language: preferences?.default_language ?? "en-GB",
    onResult: (transcript) => {
      void run(transcript, "voice");
      setTab("ask");
    },
  });

  useEffect(() => {
    const node = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, busy, tab]);

  const favourites = preferences?.favorite_commands ?? [];
  const executive = useMemo(() => rankCommands(EXECUTIVE_COMMANDS, preferences), [preferences]);
  const recent = preferences?.recent_searches ?? [];

  function submit(phrase?: string) {
    const value = (phrase ?? draft).trim();
    if (!value) return;
    setDraft("");
    setTab("ask");
    void run(value, "text");
  }

  async function favourite(id: string) {
    await toggleFavoriteCommand(id, preferences);
    await copilot.savePreferences({});
  }

  // --- Launcher / minimised pill -------------------------------------------
  if (!open || minimised) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 md:bottom-6 md:right-6">
        {open && minimised && messages.length > 0 && (
          <button
            type="button"
            onClick={restore}
            className="flex h-11 items-center gap-2 rounded-full border border-border bg-background/95 px-3 text-xs shadow-lg backdrop-blur"
          >
            <History className="size-3.5 text-primary" />
            <span className="max-w-32 truncate">{messages[messages.length - 1]?.text}</span>
            <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
              {messages.filter((m) => m.role === "assistant").length}
            </Badge>
          </button>
        )}
        <Button
          type="button"
          onClick={() => (open ? restore() : setOpen(true))}
          className="h-14 w-14 rounded-full shadow-xl"
          aria-label="Open Aegis Copilot"
        >
          <Bot className="size-6" />
        </Button>
      </div>
    );
  }

  // --- Full panel -----------------------------------------------------------
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col border-border bg-background/95 backdrop-blur-xl",
        "md:inset-auto md:bottom-6 md:right-6 md:h-[680px] md:max-h-[calc(100vh-3rem)] md:w-[440px] md:rounded-2xl md:border md:shadow-2xl",
      )}
      role="dialog"
      aria-label="Aegis Copilot"
    >
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Aegis Copilot™</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {context?.label ?? context?.reference ?? "Executive intelligence · ⌘K"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={minimise} aria-label="Minimise copilot">
            <ChevronDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Close copilot"
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-3 grid grid-cols-4">
          <TabsTrigger value="ask" className="text-xs">
            Ask
          </TabsTrigger>
          <TabsTrigger value="library" className="text-xs">
            Library
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">
            <Settings2 className="size-3.5" />
          </TabsTrigger>
        </TabsList>

        {/* Ask ---------------------------------------------------------- */}
        <TabsContent value="ask" className="min-h-0 flex-1">
          <ScrollArea
            ref={scrollRef}
            className="h-full px-3 py-3 [&_[data-radix-scroll-area-viewport]>div]:!block"
          >
            <div className="w-full min-w-0 space-y-3 pb-2">
              {messages.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-4 text-center">
                  <p className="text-sm font-medium">Ask anything about your estate</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    “Generate executive report”, “compare regions”, “open alerts”, or speak your
                    command.
                  </p>
                </div>
              )}

              {context?.conversationId && (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-primary">
                    Context · {context.reference ?? "conversation"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {CONVERSATION_COMMANDS.map((card) => (
                      <Button
                        key={card.id}
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => submit(card.phrase)}
                      >
                        {card.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-xl rounded-br-sm bg-primary/15 px-3 py-2 text-xs text-foreground">
                      {message.mode === "voice" && <Mic className="mr-1 inline size-3" />}
                      {message.text}
                    </p>
                  </div>
                ) : message.response ? (
                  <CopilotResponseCard
                    key={message.id}
                    response={message.response}
                    busy={busy}
                    onFollowUp={(command) => submit(command)}
                    onResume={
                      message.response.report
                        ? () => void run(message.text, "text", { resume: message.response!.report })
                        : undefined
                    }
                  />
                ) : (
                  <p key={message.id} className="text-xs text-muted-foreground">
                    {message.text}
                  </p>
                ),
              )}

              {busy && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Working on it…
                </p>
              )}
              {voice.state === "listening" && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                  <span className="flex items-end gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className="w-1 animate-pulse rounded-full bg-primary"
                        style={{
                          height: `${6 + ((i + Math.round(voice.level * 6)) % 5) * 3}px`,
                          animationDelay: `${i * 90}ms`,
                        }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {voice.interim || "Listening…"}
                  </span>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Library ------------------------------------------------------ */}
        <TabsContent value="library" className="min-h-0 flex-1">
          <ScrollArea className="h-full px-3 py-3">
            <div className="space-y-4 pb-2">
              {recent.length > 0 && (
                <section>
                  <h4 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Recent searches
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.slice(0, 8).map((phrase) => (
                      <Button
                        key={phrase}
                        size="sm"
                        variant="outline"
                        className="h-7 max-w-full text-[11px]"
                        onClick={() => submit(phrase)}
                      >
                        <span className="truncate">{phrase}</span>
                      </Button>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h4 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Executive commands
                </h4>
                <CommandGrid
                  cards={executive}
                  onRun={submit}
                  favourites={favourites}
                  onFavourite={(id) => void favourite(id)}
                />
              </section>

              <section>
                <h4 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Conversation actions
                </h4>
                <CommandGrid
                  cards={CONVERSATION_COMMANDS}
                  onRun={submit}
                  favourites={favourites}
                  onFavourite={(id) => void favourite(id)}
                />
              </section>

              <section>
                <h4 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  On the roadmap
                </h4>
                <div className="space-y-2">
                  {ROADMAP.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-dashed border-border p-3"
                    >
                      <p className="text-xs font-semibold">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* History ------------------------------------------------------ */}
        <TabsContent value="history" className="min-h-0 flex-1">
          <ScrollArea className="h-full px-3 py-3">
            <div className="space-y-2 pb-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {messages.filter((m) => m.role === "user").length} commands this device
                </p>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clear}>
                  <Trash2 className="mr-1 size-3" /> Clear
                </Button>
              </div>
              {[...messages]
                .filter((m) => m.role === "user")
                .reverse()
                .map((message) => (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => submit(message.text)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2 text-left"
                  >
                    {message.mode === "voice" ? (
                      <Mic className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <MessagesSquare className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs">{message.text}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Settings ----------------------------------------------------- */}
        <TabsContent value="settings" className="min-h-0 flex-1">
          <ScrollArea className="h-full px-3 py-3">
            <div className="space-y-4 pb-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/60 p-3">
                <div className="min-w-0">
                  <Label className="text-xs">Voice commands</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {voice.supported
                      ? "Speak to the copilot using your device microphone."
                      : "Speech recognition is unavailable in this browser."}
                  </p>
                </div>
                <Switch
                  checked={(preferences?.voice_enabled ?? true) && voice.supported}
                  disabled={!voice.supported}
                  onCheckedChange={(checked) =>
                    void copilot.savePreferences({ voice_enabled: checked })
                  }
                />
              </div>

              <div className="rounded-xl border border-border bg-surface/60 p-3">
                <Label className="text-xs">Voice language</Label>
                <Input
                  value={preferences?.default_language ?? "en-GB"}
                  onChange={(event) =>
                    void copilot.savePreferences({ default_language: event.target.value })
                  }
                  className="mt-2 h-9 text-xs"
                  aria-label="Voice language"
                />
              </div>

              <div className="rounded-xl border border-border bg-surface/60 p-3">
                <p className="text-xs font-semibold">Personalisation</p>
                <dl className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
                  <div className="flex justify-between gap-3">
                    <dt>Favourite outlet</dt>
                    <dd className="truncate text-foreground">
                      {preferences?.favorite_outlet_id ? "Set" : "Not set"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Pinned dashboards</dt>
                    <dd className="text-foreground">
                      {preferences?.pinned_dashboards?.length ?? 0}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Favourite reports</dt>
                    <dd className="text-foreground">
                      {preferences?.favorite_reports?.length ?? 0}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Recent searches</dt>
                    <dd className="text-foreground">{recent.length}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Say “set favourite outlet …” or “pin command centre” to tune your defaults.
                </p>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <footer className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Button
            type="button"
            variant={voice.state === "listening" ? "default" : "outline"}
            size="icon"
            className="size-11 shrink-0 rounded-full"
            disabled={!voice.supported || preferences?.voice_enabled === false}
            onClick={() => (voice.state === "listening" ? voice.stop() : voice.start())}
            aria-label={voice.state === "listening" ? "Stop listening" : "Start voice command"}
          >
            {voice.supported && preferences?.voice_enabled !== false ? (
              <Mic className="size-4" />
            ) : (
              <MicOff className="size-4" />
            )}
          </Button>
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask or command…"
            className="h-11 bg-surface text-sm"
            aria-label="Copilot command"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            disabled={busy || draft.trim().length === 0}
            aria-label="Send command"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </footer>
    </div>
  );
}
