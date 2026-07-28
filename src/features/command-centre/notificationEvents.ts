/**
 * Notification event catalogue.
 *
 * Browser-safe: shared by the settings UI, the client dispatch helpers and the
 * server-side fan-out so a rule, a webhook endpoint and a delivery row always
 * speak about the same event names.
 */

export const NOTIFICATION_EVENTS = [
  "export.completed",
  "export.failed",
  "delivery.completed",
  "delivery.failed",
  "report.completed",
  "report.failed",
  "access_request.created",
  "access_request.approved",
  "access_request.denied",
  "access_request.expired",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const EVENT_LABELS: Record<NotificationEvent, string> = {
  "export.completed": "Export completed",
  "export.failed": "Export failed",
  "delivery.completed": "Scheduled delivery completed",
  "delivery.failed": "Scheduled delivery failed",
  "report.completed": "Executive report completed",
  "report.failed": "Executive report failed",
  "access_request.created": "Widget access requested",
  "access_request.approved": "Widget access approved",
  "access_request.denied": "Widget access denied",
  "access_request.expired": "Widget access request expired",
};

export const EVENT_GROUPS: { label: string; events: NotificationEvent[] }[] = [
  {
    label: "Exports & deliveries",
    events: [
      "export.completed",
      "export.failed",
      "delivery.completed",
      "delivery.failed",
      "report.completed",
      "report.failed",
    ],
  },
  {
    label: "Access requests",
    events: [
      "access_request.created",
      "access_request.approved",
      "access_request.denied",
      "access_request.expired",
    ],
  },
];

export type NotificationChannel = "email" | "slack" | "teams" | "webhook";

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: "Email",
  slack: "Slack webhook",
  teams: "Microsoft Teams webhook",
  webhook: "Custom webhook",
};

export function isFailureEvent(event: string): boolean {
  return event.endsWith(".failed") || event.endsWith(".denied") || event.endsWith(".expired");
}
