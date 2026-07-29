import { createFileRoute } from "@tanstack/react-router";

import { MeteredUsageDashboard } from "@/components/administration/MeteredUsage";

export const Route = createFileRoute("/_authenticated/platform/usage")({
  head: () => ({
    meta: [
      { title: "Platform Metered Usage — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Super admin view of Copilot queries, audio minutes, storage, egress and remaining allowances per outlet and per tenant.",
      },
      { property: "og:title", content: "Platform Metered Usage — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Cross-estate consumption metering for the AegisIQ CX platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <MeteredUsageDashboard />,
});
