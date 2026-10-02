/**
 * Transcript insight extraction via the Lovable AI Gateway (Responses API, streamed).
 */
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export interface TranscriptInsights {
  intent: { primary: string; secondary: string[]; confidence: number };
  sentiment: { overall: string; score: number };
  drivers: { factor: string; impact: "positive" | "negative" | "neutral"; evidence: string }[];
  actions: { action: string; owner: string; priority: "low" | "medium" | "high"; rationale: string }[];
  summary: string;
}

const SYSTEM = `You are a senior customer-experience analyst. Analyse the transcript and return ONLY a JSON object with this exact shape:
{"intent":{"primary":string,"secondary":string[],"confidence":number 0-1},
 "sentiment":{"overall":"very_negative"|"negative"|"neutral"|"positive"|"very_positive","score":number -1..1},
 "drivers":[{"factor":string,"impact":"positive"|"negative"|"neutral","evidence":short quote from transcript}],
 "actions":[{"action":string,"owner":string (role e.g. Store Manager),"priority":"low"|"medium"|"high","rationale":string}],
 "summary":string (2 sentences)}
Give 2-6 drivers and 2-5 actions. Base everything strictly on the transcript; do not invent facts. No markdown, no prose outside JSON.`;

export class GatewayError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function extractInsights(transcript: string, context?: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new GatewayError("AI is not configured for this workspace.", 401);

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions: SYSTEM,
      input: [
        {
          role: "user",
          content: `${context ? `Context: ${context}\n\n` : ""}Transcript:\n${transcript.slice(0, 30_000)}`,
        },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    let msg = "";
    try {
      msg = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? "";
    } catch {
      msg = body.slice(0, 200);
    }
    const fallback =
      res.status === 429
        ? "AI is rate limited — try again shortly."
        : res.status === 402
          ? "AI credits are exhausted. Add credits in Settings → Plans & credits."
          : `AI request failed (${res.status}).`;
    throw new GatewayError(msg || fallback, res.status);
  }

  // Consume the SSE stream and collect output text.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const evt = JSON.parse(data);
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string")
          text += evt.delta;
        if (evt.type === "error" || evt.type === "response.failed")
          throw new GatewayError(
            evt.error?.message ?? evt.response?.error?.message ?? "AI request failed.",
            500,
          );
      } catch (e) {
        if (e instanceof GatewayError) throw e;
      }
    }
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new GatewayError("The model returned no analysis. Try a longer transcript.", 422);
  let parsed: TranscriptInsights;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new GatewayError("The model returned an unreadable analysis.", 422);
  }
  return {
    intent: {
      primary: String(parsed.intent?.primary ?? "Unknown"),
      secondary: (parsed.intent?.secondary ?? []).map(String).slice(0, 5),
      confidence: Math.min(1, Math.max(0, Number(parsed.intent?.confidence) || 0)),
    },
    sentiment: {
      overall: String(parsed.sentiment?.overall ?? "neutral"),
      score: Math.min(1, Math.max(-1, Number(parsed.sentiment?.score) || 0)),
    },
    drivers: (parsed.drivers ?? []).slice(0, 8),
    actions: (parsed.actions ?? []).slice(0, 8),
    summary: String(parsed.summary ?? ""),
  } satisfies TranscriptInsights;
}
