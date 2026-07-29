import { createFileRoute } from "@tanstack/react-router";

import { MeteredUsageDashboard } from "@/components/administration/MeteredUsage";

export const Route = createFileRoute("/_authenticated/administration/usage")({
  head: () => ({
    meta: [
      { title: "Metered Usage — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Track Copilot queries, audio minutes processed, storage and egress against workspace allowances, per outlet and per tenant.",
      },
      { property: "og:title", content: "Metered Usage — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Consumption and remaining allowances for every outlet in the workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <MeteredUsageDashboard />,
});
