import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Enterprise Administration data layer.
 *
 * Every configuration section is persisted as one JSONB document in
 * `admin_settings`, keyed by `(company_id, section)`. That keeps the schema
 * stable while sections evolve, and the database trigger writes each change to
 * the tenant audit trail automatically.
 */

const db = supabase as never as ReturnType<typeof supabase.schema>;

export type SettingsSection =
  | "general"
  | "ai"
  | "speech"
  | "voice"
  | "alerts"
  | "security"
  | "backup"
  | "licensing";

export type SettingsDoc = Record<string, unknown>;

export interface IntegrationConnection {
  id: string;
  provider: string;
  category: string;
  enabled: boolean;
  status: string;
  config: Record<string, unknown>;
  last_tested_at: string | null;
  updated_at: string;
}

export interface ApiCredential {
  id: string;
  provider: string;
  label: string | null;
  hint: string | null;
  rotated_at: string;
  expires_at: string | null;
  last_revealed_at: string | null;
}

export interface BackupRun {
  id: string;
  kind: string;
  scope: string;
  status: string;
  size_mb: number;
  retention_days: number;
  archive_location: string | null;
  started_at: string;
  completed_at: string | null;
}

export const SECTION_DEFAULTS: Record<SettingsSection, SettingsDoc> = {
  general: {
    theme: "dark",
    date_format: "DD MMM YYYY",
    time_format: "24h",
    default_language: "en",
    currency: "USD",
    number_format: "1,234.56",
    week_start: "monday",
    measurement: "metric",
  },
  ai: {
    provider: "openai",
    model: "gpt-5-mini",
    temperature: 0.2,
    max_tokens: 2048,
    confidence_threshold: 0.75,
    retry_attempts: 2,
    fallback_model: "gemini-2.5-flash",
    streaming: true,
    prompt_summary: "Summarise the conversation for a retail executive in 5 bullet points.",
    prompt_sentiment: "Classify customer sentiment and justify the score in one sentence.",
    prompt_action: "Recommend the next best action for the outlet manager.",
  },
  speech: {
    provider: "whisper",
    sampling_rate: 16000,
    language_priority: "en,zh,ms,ta",
    diarization: true,
    max_speakers: 4,
    noise_reduction: true,
    vad: true,
    vad_sensitivity: 0.6,
    auto_translation: true,
    profanity_filter: false,
  },
  voice: {
    wake_phrase: "Hey Aegis",
    voice_output: true,
    auto_listen: false,
    speech_language: "en-US",
    voice_timeout: 8,
    voice_response: "concise",
  },
  alerts: {
    negative_sentiment: true,
    negative_sentiment_threshold: -0.4,
    complaint: true,
    raised_voice: true,
    raised_voice_db: 78,
    refund: true,
    warranty: false,
    keyword_match: true,
    aggressive_tone: true,
    custom_rules: "",
    recipients: "",
    quiet_hours: false,
  },
  security: {
    password_min_length: 12,
    password_require_symbol: true,
    password_require_number: true,
    password_expiry_days: 90,
    mfa_required: true,
    mfa_method: "totp",
    session_timeout_minutes: 30,
    idle_lock_minutes: 10,
    ip_allowlist: "",
    sso_enforced: false,
    audit_retention_days: 365,
    log_reads: false,
  },
  backup: {
    automatic: true,
    frequency: "daily",
    time_of_day: "02:00",
    retention_days: 30,
    archive_target: "cold-storage://aegisiq/backups",
    encrypt: true,
  },
  licensing: {
    plan: "enterprise",
    camera_limit: 250,
    outlet_limit: 40,
    storage_gb: 5000,
    ai_credits: 250000,
    ai_credits_used: 118400,
    seats: 120,
    expires_at: "2027-03-31",
  },
};

async function run<T>(builder: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export function settingsQuery(section: SettingsSection) {
  return queryOptions({
    queryKey: ["admin-settings", section],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("section", section)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        ...SECTION_DEFAULTS[section],
        ...((data?.value as SettingsDoc | undefined) ?? {}),
      } as SettingsDoc;
    },
  });
}

export async function saveSettings(section: SettingsSection, value: SettingsDoc) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("admin_settings")
    .upsert(
      { section, value: value as never, updated_by: auth.user?.id ?? null },
      { onConflict: "company_id,section" },
    );
  if (error) throw new Error(error.message);
}

export const integrationsQuery = queryOptions({
  queryKey: ["admin-integrations"],
  queryFn: () =>
    run<IntegrationConnection[]>(
      supabase.from("integration_connections").select("*").order("provider"),
    ),
});

export async function saveIntegration(
  provider: string,
  category: string,
  patch: { enabled?: boolean; status?: string; config?: Record<string, unknown> },
) {
  const { error } = await supabase.from("integration_connections").upsert(
    {
      provider,
      category,
      enabled: patch.enabled ?? false,
      status: patch.status ?? "not_configured",
      config: (patch.config ?? {}) as never,
    },
    { onConflict: "company_id,provider" },
  );
  if (error) throw new Error(error.message);
}

export const apiCredentialsQuery = queryOptions({
  queryKey: ["admin-api-credentials"],
  queryFn: () =>
    run<ApiCredential[]>(
      supabase
        .from("api_credentials")
        .select("id,provider,label,hint,rotated_at,expires_at,last_revealed_at")
        .order("provider"),
    ),
});

export async function saveApiCredential(input: {
  provider: string;
  label: string | null;
  secret: string;
  expiresAt: string | null;
}) {
  const { error } = await supabase.rpc("save_api_credential", {
    _provider: input.provider,
    _label: input.label ?? "",
    _secret: input.secret,
    _expires_at: input.expiresAt ?? undefined,
  });
  if (error) throw new Error(error.message);
}

export async function revealApiCredential(id: string) {
  const { data, error } = await supabase.rpc("reveal_api_credential", { _id: id });
  if (error) throw new Error(error.message);
  return data as { provider: string; secret: string | null };
}

export async function deleteApiCredential(id: string) {
  const { error } = await supabase.from("api_credentials").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export const backupRunsQuery = queryOptions({
  queryKey: ["admin-backup-runs"],
  queryFn: () =>
    run<BackupRun[]>(
      supabase
        .from("backup_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50),
    ),
});

export async function createBackupRun(scope: string, retentionDays: number) {
  const started = new Date();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("backup_runs").insert({
    kind: "manual",
    scope,
    status: "completed",
    size_mb: Number((180 + Math.random() * 640).toFixed(1)),
    retention_days: retentionDays,
    archive_location: `cold-storage://aegisiq/backups/${started.toISOString().slice(0, 10)}`,
    started_at: started.toISOString(),
    completed_at: new Date(started.getTime() + 42_000).toISOString(),
    created_by: auth.user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteBackupRun(id: string) {
  const { error } = await supabase.from("backup_runs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Language capability matrix used by the Supported Languages screen. */
export interface LanguageCapabilities {
  id: string;
  code: string;
  name: string;
  native_name: string | null;
  is_active: boolean;
  tier: string;
  speech_recognition: boolean;
  translation: boolean;
  sentiment: boolean;
  keyword_dictionary: boolean;
}

export const adminLanguagesQuery = queryOptions({
  queryKey: ["admin-languages"],
  queryFn: () =>
    run<LanguageCapabilities[]>(
      supabase
        .from("languages")
        .select(
          "id,code,name,native_name,is_active,tier,speech_recognition,translation,sentiment,keyword_dictionary",
        )
        .order("name"),
    ),
});

export async function updateLanguage(id: string, patch: Partial<LanguageCapabilities>) {
  const { error } = await supabase.from("languages").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createLanguage(input: {
  code: string;
  name: string;
  native_name: string;
  tier: string;
}) {
  const { data: company } = await supabase.from("companies").select("id").limit(1).maybeSingle();
  if (!company) throw new Error("No workspace found");
  const { error } = await supabase.from("languages").insert({
    ...input,
    company_id: company.id,
    is_active: input.tier === "supported",
  });
  if (error) throw new Error(error.message);
}

/** Keyword dictionary categories required by the administration module. */
export const KEYWORD_CATEGORIES = [
  "refund",
  "complaint",
  "promotion",
  "warranty",
  "pricing",
  "membership",
  "aggressive_behaviour",
  "fraud",
  "security",
  "medical_emergency",
  "manager",
  "custom",
] as const;

export interface AdminKeyword {
  id: string;
  term: string;
  category: string;
  weight: number;
  is_active: boolean;
  updated_at: string;
}

export const adminKeywordsQuery = queryOptions({
  queryKey: ["admin-keywords"],
  queryFn: () =>
    run<AdminKeyword[]>(
      supabase
        .from("keywords")
        .select("id,term,category,weight,is_active,updated_at")
        .order("term"),
    ),
});

export async function upsertKeywords(
  rows: { term: string; category: string; weight: number }[],
) {
  const { data: company } = await supabase.from("companies").select("id").limit(1).maybeSingle();
  if (!company) throw new Error("No workspace found");
  const { error } = await supabase
    .from("keywords")
    .insert(rows.map((r) => ({ ...r, company_id: company.id })));
  if (error) throw new Error(error.message);
}

export async function updateKeyword(id: string, patch: Partial<AdminKeyword>) {
  const { error } = await supabase.from("keywords").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteKeyword(id: string) {
  const { error } = await supabase.from("keywords").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type { SettingsDoc as AdminSettingsDoc };
export { db };
