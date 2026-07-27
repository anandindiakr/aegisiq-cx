import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";

export type EntityStatus = "active" | "inactive" | "suspended" | "archived";
export type CameraStatus = "online" | "offline" | "degraded" | "maintenance";
export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertStatus = "open" | "acknowledged" | "resolved" | "dismissed";
export type AppRole =
  | "super_admin"
  | "tenant_admin"
  | "regional_manager"
  | "outlet_manager"
  | "supervisor"
  | "viewer";

export interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  industry: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  subscription_plan: string;
  status: EntityStatus;
  timezone: string;
  preferred_languages: string[];
  brand_primary_color: string;
  brand_tagline: string | null;
  created_at: string;
}

export interface Outlet {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  timezone: string;
  manager_name: string | null;
  manager_email: string | null;
  status: EntityStatus;
  opened_at: string | null;
}

export interface Camera {
  id: string;
  outlet_id: string | null;
  name: string;
  rtsp_url: string | null;
  location: string | null;
  status: CameraStatus;
  audio_enabled: boolean;
  firmware: string | null;
  last_seen_at: string | null;
}

export interface Conversation {
  id: string;
  outlet_id: string | null;
  camera_id: string | null;
  reference: string;
  started_at: string;
  duration_seconds: number;
  language_code: string;
  sentiment_score: number;
  sentiment: string;
  topic: string | null;
  agent_name: string | null;
  customer_type: string | null;
  escalated: boolean;
}

export interface AlertRow {
  id: string;
  outlet_id: string | null;
  conversation_id: string | null;
  title: string;
  description: string | null;
  category: string;
  severity: AlertSeverity;
  status: AlertStatus;
  triggered_at: string;
}

export interface StaffProfile {
  id: string;
  user_id: string | null;
  outlet_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  directory_role: AppRole;
  status: EntityStatus;
  last_active_at: string | null;
}

export interface AuditLog {
  id: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KeywordRow {
  id: string;
  term: string;
  category: string;
  weight: number;
  is_active: boolean;
}

export interface LanguageRow {
  id: string;
  code: string;
  name: string;
  native_name: string | null;
  is_active: boolean;
}

// Untyped table access keeps the data layer stable while the generated
// database types catch up with new migrations.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;

const rawDb = supabase as unknown as { from: (table: string) => AnyBuilder };

// Tenant scoping (defence in depth). Row-level security is the enforcement
// point in the database; the client additionally filters every tenant table by
// the company resolved in the `_authenticated` route guard, so a mis-scoped
// query fails closed instead of relying on RLS alone.
let activeCompanyId: string | null = null;
const GLOBAL_TABLES = new Set(["companies", "user_roles"]);

export function setActiveTenant(companyId: string | null) {
  activeCompanyId = companyId;
}

export function getActiveTenant() {
  return activeCompanyId;
}

const db = {
  from(table: string): AnyBuilder {
    const builder = rawDb.from(table);
    if (!activeCompanyId || GLOBAL_TABLES.has(table)) return builder;
    return new Proxy(builder, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const next = value.apply(target, args);
          // Scope the first query verb (select / update / delete).
          if (
            (prop === "select" || prop === "update" || prop === "delete") &&
            next &&
            typeof next.eq === "function"
          ) {
            return next.eq("company_id", activeCompanyId);
          }
          return next;
        };
      },
    });
  },
};

async function run<T>(
  builder: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  operation = "supabase.query",
) {
  return traced(operation, async () => {
    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    return (data ?? []) as T;
  });
}

export const companyQuery = queryOptions({
  queryKey: ["company"],
  queryFn: async () => {
    const { data, error } = await db.from("companies").select("*").limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Company | null;
  },
});

export const outletsQuery = queryOptions({
  queryKey: ["outlets"],
  queryFn: () => run<Outlet[]>(db.from("outlets").select("*").order("code")),
});

export const camerasQuery = queryOptions({
  queryKey: ["cameras"],
  queryFn: () => run<Camera[]>(db.from("cameras").select("*").order("name")),
});

export const conversationsQuery = queryOptions({
  queryKey: ["conversations"],
  queryFn: () =>
    run<Conversation[]>(
      db
        .from("conversations")
        .select(
          "id,outlet_id,camera_id,reference,started_at,duration_seconds,language_code,sentiment_score,sentiment,topic,agent_name,customer_type,escalated",
        )
        .order("started_at", { ascending: false })
        .limit(1000),
    ),
});

export const alertsQuery = queryOptions({
  queryKey: ["alerts"],
  queryFn: () =>
    run<AlertRow[]>(
      db.from("alerts").select("*").order("triggered_at", { ascending: false }).limit(300),
    ),
});

export const staffQuery = queryOptions({
  queryKey: ["staff"],
  queryFn: () => run<StaffProfile[]>(db.from("profiles").select("*").order("full_name")),
});

export const auditLogsQuery = queryOptions({
  queryKey: ["audit-logs"],
  queryFn: () =>
    run<AuditLog[]>(
      db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
    ),
});

export const keywordsQuery = queryOptions({
  queryKey: ["keywords"],
  queryFn: () =>
    run<KeywordRow[]>(db.from("keywords").select("*").order("weight", { ascending: false })),
});

export const languagesQuery = queryOptions({
  queryKey: ["languages"],
  queryFn: () => run<LanguageRow[]>(db.from("languages").select("*").order("name")),
});

export const myProfileQuery = queryOptions({
  queryKey: ["my-profile"],
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await db
      .from("profiles")
      .select("*")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as StaffProfile | null;
  },
});

export const myRolesQuery = queryOptions({
  queryKey: ["my-roles"],
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return [] as AppRole[];
    const rows = await run<{ role: AppRole }[]>(
      db.from("user_roles").select("role").eq("user_id", auth.user.id),
    );
    return rows.map((r) => r.role);
  },
});

export async function updateAlertStatus(id: string, status: AlertStatus) {
  const { error } = await db
    .from("alerts")
    .update({ status, acknowledged_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateCompany(id: string, patch: Partial<Company>) {
  const { error } = await db.from("companies").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateOutlet(id: string, patch: Partial<Outlet>) {
  const { error } = await db.from("outlets").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateCamera(id: string, patch: Partial<Camera>) {
  const { error } = await db.from("cameras").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Audit logs: server-side filtering + pagination
// ---------------------------------------------------------------------------

export interface AuditLogFilters {
  actor: string;
  action: string;
  entityType: string;
  outletId: string;
  page: number;
  pageSize: number;
}

export interface AuditLogPage {
  rows: AuditLog[];
  total: number;
}

export const auditLogFilterOptionsQuery = queryOptions({
  queryKey: ["audit-log-filters"],
  queryFn: async () => {
    const rows = await run<
      { actor_id: string | null; actor_name: string | null; action: string; entity_type: string }[]
    >(
      db.from("audit_logs").select("actor_id,actor_name,action,entity_type").limit(1000),
      "supabase.audit_log_filters",
    );
    const actors = new Map<string, string>();
    const actions = new Set<string>();
    const entities = new Set<string>();
    for (const row of rows) {
      if (row.actor_name) actors.set(row.actor_name, row.actor_name);
      actions.add(row.action);
      entities.add(row.entity_type);
    }
    return {
      actors: [...actors.keys()].sort(),
      actions: [...actions].sort(),
      entityTypes: [...entities].sort(),
    };
  },
});

export function auditLogsPageQuery(filters: AuditLogFilters) {
  return queryOptions({
    queryKey: ["audit-logs", filters],
    queryFn: async (): Promise<AuditLogPage> =>
      traced("supabase.audit_logs_page", async () => {
        const from = filters.page * filters.pageSize;
        let query = db
          .from("audit_logs")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, from + filters.pageSize - 1);

        if (filters.actor !== "all") query = query.eq("actor_name", filters.actor);
        if (filters.action !== "all") query = query.eq("action", filters.action);
        if (filters.entityType !== "all") query = query.eq("entity_type", filters.entityType);
        if (filters.outletId !== "all")
          query = query.filter("metadata->>outlet_id", "eq", filters.outletId);

        const { data, error, count } = await query;
        if (error) throw new Error(error.message);
        return { rows: (data ?? []) as AuditLog[], total: count ?? 0 };
      }),
  });
}
