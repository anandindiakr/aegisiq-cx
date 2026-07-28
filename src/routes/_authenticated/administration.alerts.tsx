import { createFileRoute } from "@tanstack/react-router";

import { SettingsForm } from "@/components/administration/SettingsForm";

export const Route = createFileRoute("/_authenticated/administration/alerts")({
  component: AlertSettingsPage,
});

function AlertSettingsPage() {
  return (
    <SettingsForm
      section="alerts"
      groups={[
        {
          title: "Detection triggers",
          description: "Signals that raise an alert into the Alert Centre for this tenant",
          fields: [
            { key: "negative_sentiment", label: "Negative sentiment", type: "switch" },
            {
              key: "negative_sentiment_threshold",
              label: "Sentiment trigger score",
              type: "slider",
              min: -1,
              max: 0,
              step: 0.05,
              hint: "Alert when the conversation score drops below this value",
            },
            { key: "complaint", label: "Complaint detected", type: "switch" },
            { key: "raised_voice", label: "Raised voice", type: "switch" },
            {
              key: "raised_voice_db",
              label: "Raised voice threshold (dB)",
              type: "number",
              min: 50,
              max: 110,
            },
            { key: "refund", label: "Refund request", type: "switch" },
            { key: "warranty", label: "Warranty dispute", type: "switch" },
            { key: "keyword_match", label: "Keyword dictionary match", type: "switch" },
            { key: "aggressive_tone", label: "Aggressive tone", type: "switch" },
          ],
        },
        {
          title: "Custom rules and recipients",
          description: "Advanced expressions and the distribution list for triggered alerts",
          fields: [
            {
              key: "custom_rules",
              label: "Custom rules",
              type: "textarea",
              placeholder:
                "sentiment < -0.6 AND keyword IN (refund, manager) AND outlet.region = 'APAC'",
              hint: "One rule per line, evaluated after the built-in triggers",
            },
            {
              key: "recipients",
              label: "Recipients",
              type: "textarea",
              placeholder: "ops@company.com, #cx-alerts (Slack), Duty Manager (Teams)",
              hint: "Delivery honours the channel configuration under Integrations",
            },
            {
              key: "quiet_hours",
              label: "Respect quiet hours",
              type: "switch",
              hint: "Hold non-critical alerts outside outlet trading hours",
            },
          ],
        },
      ]}
    />
  );
}
