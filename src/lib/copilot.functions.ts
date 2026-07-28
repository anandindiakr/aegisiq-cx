/**
 * Server functions for Aegis Copilot™ transcript intelligence.
 *
 * Thin wrapper by design: all runtime logic lives in `copilot-ai.server` so
 * nothing but the exported declarations survives client-side splitting.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runTranscriptTask } from "@/lib/copilot-ai.server";

const schema = z.object({
  task: z.enum(["summarise", "translate", "sentiment"]),
  transcript: z.string().min(1).max(40_000),
  targetLanguage: z.string().max(60).optional(),
  meta: z.string().max(500).optional(),
});

export const analyseTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => ({ text: await runTranscriptTask(data) }));
