import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractInsights, GatewayError } from "@/lib/transcript-insights.server";

const schema = z.object({
  transcript: z.string().trim().min(40, "Transcript is too short to analyse").max(40_000),
  context: z.string().trim().max(500).optional(),
});

export const analyseTranscriptInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, insights: await extractInsights(data.transcript, data.context) };
    } catch (e) {
      if (e instanceof GatewayError)
        return { ok: false as const, status: e.status, error: e.message };
      throw e;
    }
  });
