import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BACKUP_TABLES: Record<string, string[]> = {
  full: [
    "companies",
    "outlets",
    "cameras",
    "edge_gateways",
    "ai_engines",
    "conversations",
    "transcripts",
    "alerts",
    "keywords",
    "languages",
    "admin_settings",
    "notification_rules",
    "sla_policies",
  ],
  configuration: [
    "companies",
    "outlets",
    "cameras",
    "edge_gateways",
    "ai_engines",
    "admin_settings",
    "notification_rules",
    "sla_policies",
    "keywords",
    "languages",
  ],
  conversations: ["conversations", "transcripts", "summaries", "conversation_events"],
};

/**
 * Executes a queued backup run: exports the tenant's rows for the requested
 * scope as JSON, uploads the archive to the private `backups` storage bucket,
 * and marks the run completed (or failed) with the real archive size.
 */
export const runBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ backupRunId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Confirm the run exists and belongs to the caller's tenant (RLS-scoped read).
    const { data: runRow, error: runError } = await context.supabase
      .from("backup_runs")
      .select("id, scope, status, company_id")
      .eq("id", data.backupRunId)
      .single();
    if (runError || !runRow) throw new Error("Backup run not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tables = BACKUP_TABLES[runRow.scope] ?? BACKUP_TABLES.full;
    const companyId = runRow.company_id as string;

    try {
      await supabaseAdmin
        .from("backup_runs")
        .update({ status: "running" })
        .eq("id", data.backupRunId);

      const archive: Record<string, unknown> = {
        generated_at: new Date().toISOString(),
        scope: runRow.scope,
        company_id: companyId,
        tables: {} as Record<string, unknown[]>,
      };
      const tableData = archive.tables as Record<string, unknown[]>;

      // Table names are dynamic, so use an untyped handle for the export loop.
      const fromAny = supabaseAdmin.from.bind(supabaseAdmin) as (
        table: string,
      ) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
          };
        };
      };

      for (const table of tables) {
        const { data: rows, error } = await fromAny(table)
          .select("*")
          .eq("company_id", companyId)
          .limit(50000);
        if (error) {
          // Table may lack company_id; skip rather than fail the whole archive.
          tableData[table] = [];
          continue;
        }
        tableData[table] = rows ?? [];
      }

      const payload = JSON.stringify(archive);
      const bytes = new TextEncoder().encode(payload);
      const path = `${companyId}/${data.backupRunId}.json`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("backups")
        .upload(path, bytes, { contentType: "application/json", upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const sizeMb = Math.max(0.01, Math.round((bytes.length / (1024 * 1024)) * 100) / 100);
      const { error: doneError } = await supabaseAdmin
        .from("backup_runs")
        .update({
          status: "completed",
          size_mb: sizeMb,
          archive_location: `backups://${path}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", data.backupRunId);
      if (doneError) throw new Error(doneError.message);

      return { status: "completed" as const, sizeMb, path };
    } catch (err) {
      await supabaseAdmin
        .from("backup_runs")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", data.backupRunId);
      throw err instanceof Error ? err : new Error("Backup failed");
    }
  });

/** Returns a short-lived signed download URL for a completed backup archive. */
export const getBackupDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ backupRunId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: runRow, error } = await context.supabase
      .from("backup_runs")
      .select("id, status, archive_location")
      .eq("id", data.backupRunId)
      .single();
    if (error || !runRow) throw new Error("Backup run not found");
    if (runRow.status !== "completed" || !runRow.archive_location) {
      throw new Error("Backup archive is not available");
    }
    const path = runRow.archive_location.replace(/^backups:\/\//, "");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("backups")
      .createSignedUrl(path, 300);
    if (signError || !signed) throw new Error(signError?.message ?? "Could not sign download URL");
    return { url: signed.signedUrl };
  });
