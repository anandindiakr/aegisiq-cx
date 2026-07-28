/**
 * Aegis Copilot™ runtime.
 *
 * Owns the conversation thread, the surface context (what the copilot is
 * looking at), personalisation and the audit trail. Surfaces publish context
 * through `useCopilotContext`; the dock renders whatever is here.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { executiveOverviewQuery } from "@/features/command-centre/queries";
import {
  defaultFilters,
  rangeLabel,
  withPreset,
  type CommandFilters,
} from "@/features/command-centre/filters";
import { exportExecutiveReport } from "@/features/command-centre/export";
import { notify } from "@/features/command-centre/notificationChannels";
import { useIqAccess } from "@/features/conversationiq/access";
import { resolveCopilotCommand } from "@/features/copilot/engine";
import {
  finishReportRun,
  startReportRun,
  type ReportRunStatus,
} from "@/features/copilot/reportRuns";
import {
  copilotPreferencesQuery,
  recordRecentSearch,
  saveCopilotPreferences,
  withPreferenceDefaults,
  type CopilotPreferences,
} from "@/features/copilot/preferences";
import { logCopilotEvent } from "@/features/copilot/audit";
import type {
  CopilotInputMode,
  CopilotMessage,
  CopilotReportPartial,
  CopilotSurfaceContext,
} from "@/features/copilot/types";


/** Extra execution hints — used to resume a partially failed report run. */
export interface RunOptions {
  resume?: CopilotReportPartial;
}

interface CopilotState {

  open: boolean;
  minimised: boolean;
  messages: CopilotMessage[];
  busy: boolean;
  context: CopilotSurfaceContext | null;
  preferences: CopilotPreferences | null;
  filters: CommandFilters;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  minimise: () => void;
  restore: () => void;
  clear: () => void;
  run: (text: string, mode?: CopilotInputMode, options?: RunOptions) => Promise<void>;
  publishContext: (context: CopilotSurfaceContext | null) => void;
  savePreferences: (
    patch: Partial<Omit<CopilotPreferences, "id" | "company_id" | "user_id">>,
  ) => Promise<void>;
}

const Ctx = createContext<CopilotState | null>(null);

export function useCopilot(): CopilotState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useCopilot must be used inside <CopilotProvider>");
  return value;
}

/** Publishes the current surface (and its conversation) to the copilot. */
export function useCopilotContext(context: CopilotSurfaceContext | null) {
  const { publishContext } = useCopilot();
  const serialised = JSON.stringify(context ?? null);
  useEffect(() => {
    publishContext(context);
    return () => publishContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialised, publishContext]);
}

const HISTORY_KEY = "aegisiq.copilot.history";
const MAX_HISTORY = 60;

function loadHistory(): CopilotMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as CopilotMessage[]) : [];
  } catch {
    return [];
  }
}

export function CopilotProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useIqAccess();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: preferences } = useQuery(copilotPreferencesQuery);

  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [context, setContext] = useState<CopilotSurfaceContext | null>(null);
  const prefsRef = useRef<CopilotPreferences | null>(null);
  prefsRef.current = preferences ?? null;

  useEffect(() => setMessages(loadHistory()), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch {
      /* storage full or unavailable — history is best-effort */
    }
  }, [messages]);

  const filters = useMemo(
    () => withPreferenceDefaults(withPreset(defaultFilters(), "7d"), preferences ?? null),
    [preferences],
  );

  const publishContext = useCallback((next: CopilotSurfaceContext | null) => {
    setContext(next);
  }, []);

  const savePreferences = useCallback(
    async (patch: Partial<Omit<CopilotPreferences, "id" | "company_id" | "user_id">>) => {
      await saveCopilotPreferences(patch);
      await queryClient.invalidateQueries({ queryKey: ["copilot", "preferences"] });
    },
    [queryClient],
  );

  const run = useCallback(
    async (text: string, mode: CopilotInputMode = "text", options?: RunOptions) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      const started = Date.now();
      const surface = context?.surface ?? "global";

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          text: trimmed,
          mode,
          createdAt: new Date().toISOString(),
        },
      ]);
      setBusy(true);

      // Placeholder the streaming resolver fills in as sections arrive.
      const assistantId = crypto.randomUUID();
      const upsertAssistant = (message: CopilotMessage) =>
        setMessages((prev) => {
          const index = prev.findIndex((m) => m.id === assistantId);
          if (index === -1) return [...prev, message];
          const next = [...prev];
          next[index] = message;
          return next;
        });

      // Report runs are recorded in "My executive reports" so a streamed job
      // can be reopened, resumed or re-run later.
      const isReport = /executive (report|summary|brief)|generate report|brief me/i.test(trimmed);
      let runId: string | null = null;
      if (isReport) {
        runId = await startReportRun({
          command: trimmed,
          intent: "executive_report",
          inputMode: mode,
          rangeLabel: rangeLabel(filters),
          filters: filters as unknown as Record<string, unknown>,
        });
      }

      try {
        const response = await resolveCopilotCommand({
          text: trimmed,
          queryClient,
          context,
          filters,
          prefs: prefsRef.current,
          canExport: access.can("exportCompliance"),
          canViewTranscripts: access.can("viewTranscripts"),
          resume: options?.resume,
          onPartial: (partial) =>
            upsertAssistant({
              id: assistantId,
              role: "assistant",
              text: partial.title,
              mode,
              createdAt: new Date().toISOString(),
              response: { ...partial, runId: runId ?? undefined },
              pending: true,
            }),
        });

        if (runId) response.runId = runId;

        upsertAssistant({
          id: assistantId,
          role: "assistant",
          text: response.title,
          mode,
          createdAt: new Date().toISOString(),
          response,
        });

        if (runId && response.intent === "executive_report") {
          const failed = (response.report?.sections ?? []).filter(
            (s) => s.status === "failed" || s.status === "skipped",
          );
          const status: ReportRunStatus = failed.length === 0 ? "completed" : "partial";
          const durationMs = Date.now() - started;
          void finishReportRun(runId, {
            status,
            response,
            partial: response.report,
            errorMessage: failed.length > 0 ? failed.map((s) => s.label).join(", ") : undefined,
            durationMs,
          }).then(() => queryClient.invalidateQueries({ queryKey: ["copilot", "report-runs"] }));
          void notify(
            status === "completed" ? "report.completed" : "report.failed",
            status === "completed"
              ? `Executive report ready — ${rangeLabel(filters)}`
              : `Executive report incomplete — ${rangeLabel(filters)}`,
            status === "completed"
              ? `Generated in ${Math.round(durationMs / 100) / 10}s across ${response.report?.sections.length ?? 0} sections.`
              : `${failed.length} section(s) failed: ${failed.map((s) => s.label).join(", ")}.`,
            { runId, command: trimmed, status },
          );
          if (status === "partial") {
            toast.warning("Executive report finished with failed sections");
          }
        }


        // Personalisation side effects requested by the resolver.
        if (response.intent === "set_favorite_outlet" && response.entities.outletId) {
          await savePreferences({ favorite_outlet_id: response.entities.outletId });
        }
        if (response.intent === "pin_dashboard" && response.entities.dashboard) {
          const pinned = prefsRef.current?.pinned_dashboards ?? [];
          if (!pinned.includes(response.entities.dashboard)) {
            await savePreferences({
              pinned_dashboards: [...pinned, response.entities.dashboard],
            });
          }
        }

        // Real execution: exports and navigation.
        if (response.exportFormat) {
          const overview = await queryClient.ensureQueryData(executiveOverviewQuery(filters));
          exportExecutiveReport(response.exportFormat, overview, filters);
          toast.success(`Executive report exported (${response.exportFormat.toUpperCase()})`);
          if (response.intent === "export_report") {
            const favourites = prefsRef.current?.favorite_reports ?? [];
            if (!favourites.includes(response.exportFormat)) {
              await savePreferences({
                favorite_reports: [...favourites, response.exportFormat],
              });
            }
          }
        }
        if (response.autoNavigate) {
          const target = response.autoNavigate;
          navigate({
            to: target.to,
            params: target.params,
            search: target.search,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
          setMinimised(true);
        }
        if (response.outcome === "denied") {
          toast.error(response.deniedReason ?? "Access denied");
        }

        void recordRecentSearch(trimmed, prefsRef.current).then(() =>
          queryClient.invalidateQueries({ queryKey: ["copilot", "preferences"] }),
        );
        void logCopilotEvent({
          command: trimmed,
          intent: response.intent,
          inputMode: mode,
          surface,
          route: pathname,
          entities: {
            ...response.entities,
            conversationId: response.entities.conversationId ?? context?.conversationId,
          },
          outcome: response.outcome,
          deniedReason: response.deniedReason,
          durationMs: Date.now() - started,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The copilot could not respond.";
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: message,
            mode,
            createdAt: new Date().toISOString(),
            response: {
              intent: "unknown",
              title: "Command failed",
              body: [message],
              metrics: [],
              links: [],
              tone: "danger",
              outcome: "failed",
              entities: {},
            },
          },
        ]);
        void logCopilotEvent({
          command: trimmed,
          intent: "unknown",
          inputMode: mode,
          surface,
          route: pathname,
          outcome: "failed",
          deniedReason: message,
          durationMs: Date.now() - started,
        });
      } finally {
        setBusy(false);
      }
    },
    [access, busy, context, filters, navigate, pathname, queryClient, savePreferences],
  );

  // ⌘K / Ctrl+K opens the copilot from anywhere.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
        setMinimised(false);
      }
      if (event.key === "Escape") setMinimised(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<CopilotState>(
    () => ({
      open,
      minimised,
      messages,
      busy,
      context,
      preferences: preferences ?? null,
      filters,
      setOpen: (next: boolean) => {
        setOpen(next);
        if (next) setMinimised(false);
      },
      toggle: () => {
        setOpen((prev) => !prev);
        setMinimised(false);
      },
      minimise: () => setMinimised(true),
      restore: () => {
        setMinimised(false);
        setOpen(true);
      },
      clear: () => setMessages([]),
      run,
      publishContext,
      savePreferences,
    }),
    [
      busy,
      context,
      filters,
      messages,
      minimised,
      open,
      preferences,
      publishContext,
      run,
      savePreferences,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
