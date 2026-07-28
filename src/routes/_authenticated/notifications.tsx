import { createFileRoute } from "@tanstack/react-router";

import { PageHeader, Panel } from "@/components/common/Primitives";
import { NotificationSettings } from "@/components/command-centre/NotificationSettings";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications & Webhooks — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Route export outcomes and access-request decisions to chosen users by email, Slack or Teams, and send signed webhook callbacks to your backend.",
      },
      { property: "og:title", content: "Notifications & Webhooks — AegisIQ CX™" },
      {
        property: "og:description",
        content:
          "Configurable email, Slack and Teams notifications plus HMAC-signed webhook callbacks for exports, deliveries and access requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsRoute,
});

function NotificationsRoute() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications & Webhooks"
        description="Choose who is notified when exports, scheduled deliveries and widget access requests change state — and register signed callbacks for your own backend."
      />
      <Panel title="Delivery channels">
        <NotificationSettings />
      </Panel>
    </div>
  );
}
