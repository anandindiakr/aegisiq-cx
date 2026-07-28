import { createFileRoute } from "@tanstack/react-router";

import { SettingsForm } from "@/components/administration/SettingsForm";

export const Route = createFileRoute("/_authenticated/administration/ai")({
  component: AiSettingsPage,
});

function AiSettingsPage() {
  return (
    <SettingsForm
      section="ai"
      groups={[
        {
          title: "Model provider",
          description: "Primary inference route for summaries, sentiment and Aegis Copilot™",
          fields: [
            {
              key: "provider",
              label: "AI provider",
              type: "select",
              options: [
                { value: "openai", label: "OpenAI" },
                { value: "azure_openai", label: "Azure OpenAI" },
                { value: "anthropic", label: "Anthropic" },
                { value: "google", label: "Google Gemini" },
                { value: "local", label: "Local LLM" },
              ],
            },
            { key: "model", label: "Model", type: "text", placeholder: "gpt-5-mini" },
            {
              key: "fallback_model",
              label: "Fallback model",
              type: "text",
              hint: "Used when the primary model errors or exceeds latency budget",
            },
            {
              key: "retry_attempts",
              label: "AI retry attempts",
              type: "number",
              min: 0,
              max: 5,
            },
          ],
        },
        {
          title: "Inference tuning",
          description: "Controls determinism, cost ceiling and the confidence gate for automation",
          fields: [
            {
              key: "temperature",
              label: "Temperature",
              type: "slider",
              min: 0,
              max: 1,
              step: 0.05,
              hint: "Lower values keep executive summaries consistent",
            },
            {
              key: "confidence_threshold",
              label: "Confidence threshold",
              type: "slider",
              min: 0,
              max: 1,
              step: 0.05,
              hint: "Below this score results are flagged for human review",
            },
            { key: "max_tokens", label: "Max tokens", type: "number", min: 256, max: 32000 },
            {
              key: "streaming",
              label: "Stream responses",
              type: "switch",
              hint: "Progressive rendering in Copilot and report generation",
            },
          ],
        },
        {
          title: "Prompt templates",
          description: "Tenant-level system prompts applied to every AI request",
          fields: [
            { key: "prompt_summary", label: "Conversation summary", type: "textarea" },
            { key: "prompt_sentiment", label: "Sentiment classification", type: "textarea" },
            { key: "prompt_action", label: "Next best action", type: "textarea" },
          ],
        },
      ]}
    />
  );
}
