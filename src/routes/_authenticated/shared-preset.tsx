import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Eye, Lock } from "lucide-react";

import { EmptyState, LoadingState, PageHeader, Panel } from "@/components/common/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SHARE_REASONS,
  sharedFilters,
  sharedPresetQuery,
} from "@/features/command-centre/presetShares";
import {
  activeFilterCount,
  filterSummaryEntries,
  rangeLabel,
} from "@/features/command-centre/filters";

export const Route = createFileRoute("/_authenticated/shared-preset")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shared Filter Preset — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Open a colleague's shared Command Centre view. Shared presets are read-only and expire automatically.",
      },
      { property: "og:title", content: "Shared Filter Preset — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Apply a shared, read-only Command Centre filter preset without editing it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SharedPresetPage,
});

function SharedPresetPage() {
  const { token } = Route.useSearch();
  const share = useQuery(sharedPresetQuery(token));

  if (share.isLoading) return <LoadingState rows={3} />;

  const resolved = share.data;
  if (!token || !resolved?.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Shared preset" description="Read-only Command Centre view." />
        <EmptyState
          title="This link cannot be opened"
          description={
            (resolved?.reason && SHARE_REASONS[resolved.reason]) ??
            SHARE_REASONS.not_found ??
            "This share link is not valid."
          }
        />
      </div>
    );
  }

  const filters = sharedFilters(resolved);
  const preset = resolved.preset!;

  return (
    <div className="space-y-6">
      <PageHeader
        title={preset.name}
        description={preset.description ?? "A colleague shared this Command Centre view with you."}
      />

      <Panel
        title="Shared view"
        description="You can apply this view to the Command Centre. The preset itself stays read-only."
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Eye className="size-2.5" />
            Read-only
          </Badge>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Lock className="size-2.5" />
            Expires{" "}
            {resolved.expiresAt ? new Date(resolved.expiresAt).toLocaleString("en-GB") : "soon"}
          </Badge>
          <span>
            {rangeLabel(filters)} · {activeFilterCount(filters)} filters
          </span>
        </div>

        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {filterSummaryEntries(filters).map((entry) => (
            <div
              key={entry.label}
              className="rounded-lg border border-border/70 bg-surface/40 px-3 py-2"
            >
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {entry.label}
              </dt>
              <dd className="text-xs">{entry.value}</dd>
            </div>
          ))}
        </dl>

        <Button asChild className="mt-4 gap-2">
          <Link to="/command-centre" search={{ share: token }}>
            Open in Command Centre
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </Panel>
    </div>
  );
}
