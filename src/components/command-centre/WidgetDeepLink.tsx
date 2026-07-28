import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CommandFilters } from "@/features/command-centre/filters";
import { WIDGET_DEEP_LINK, toIqSearch } from "@/features/command-centre/deeplink";

/**
 * Sends the executive from any widget into ConversationIQ with the active date
 * range, global filters and the widget's own dimension pre-applied.
 */
export function WidgetDeepLink({
  widgetId,
  filters,
  label = "Open in ConversationIQ",
  className,
}: {
  widgetId: string;
  filters: CommandFilters;
  label?: string;
  className?: string;
}) {
  const search = toIqSearch(filters, WIDGET_DEEP_LINK[widgetId] ?? {}, widgetId);

  return (
    <Link
      to="/conversationiq"
      search={search}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border/70 bg-surface/70 px-2 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-primary",
        className,
      )}
    >
      <ArrowUpRight className="size-3" />
      Drill into conversations
    </Link>
  );
}
