/**
 * Server-side helpers for the copilot's transcript intelligence.
 *
 * Kept out of `*.functions.ts` so nothing but the server-function declarations
 * survives client-side splitting.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export type TranscriptTask = "summarise" | "translate" | "sentiment";

const PROMPTS: Record<TranscriptTask, string> = {
  summarise:
    "You are an enterprise customer-experience analyst. Summarise the conversation for an executive: 3-5 short bullet points covering the customer's intent, what happened, the outcome and any risk. Be factual and concise. Return markdown bullets only.",
  translate:
    "You are a professional translator. Translate the conversation transcript into the requested language, preserving speaker labels and line order. Return the translation only.",
  sentiment:
    "You are a customer-experience analyst. Explain in 3-5 short markdown bullets WHY this conversation carries the sentiment it does: cite the specific turns, tone shifts and phrases that drove it, and note anything that could escalate. Return markdown bullets only.",
};

export interface TranscriptRequest {
  task: TranscriptTask;
  transcript: string;
  targetLanguage?: string;
  meta?: string;
}

/** Calls the Lovable AI gateway and returns markdown text. */
export async function runTranscriptTask({
  task,
  transcript,
  targetLanguage,
  meta,
}: TranscriptRequest): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured for this workspace.");

  const userContent = [
    meta ? `Conversation context: ${meta}` : null,
    task === "translate" ? `Target language: ${targetLanguage ?? "English"}` : null,
    "Transcript:",
    transcript.slice(0, 24_000),
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: PROMPTS[task] },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (response.status === 429) throw new Error("Copilot is rate limited — try again shortly.");
  if (response.status === 402) throw new Error("AI credits are exhausted for this workspace.");
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI gateway error (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("The copilot returned an empty answer.");
  return content;
}
