/**
 * Server-enforced widget visibility.
 *
 * `public.widget_access_rules` states which roles may see each Command Centre
 * widget. Two security-definer functions do the evaluation in the database:
 * `allowed_widgets()` for rendering and `can_view_widget()` for authorising a
 * drill-down, so a restricted widget can neither be rendered nor deep-linked
 * into ConversationIQ by hand-editing the URL.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { traced } from "@/lib/observability";

type RpcClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

const rpcClient = supabase as unknown as RpcClient;

export const allowedWidgetsQuery = queryOptions({
  queryKey: ["command-centre", "allowed-widgets"],
  staleTime: 60_000,
  queryFn: () =>
    traced("supabase.allowed_widgets", async () => {
      const { data, error } = await rpcClient.rpc("allowed_widgets");
      if (error) throw new Error(error.message);
      return (data ?? []) as string[];
    }),
});

export function canViewWidgetQuery(widgetId: string | undefined) {
  return queryOptions({
    queryKey: ["command-centre", "can-view-widget", widgetId ?? "none"],
    staleTime: 60_000,
    queryFn: async () => {
      if (!widgetId) return true;
      const { data, error } = await rpcClient.rpc("can_view_widget", { _widget_id: widgetId });
      if (error) throw new Error(error.message);
      return data === true;
    },
  });
}

export interface WidgetAccess {
  isLoading: boolean;
  allowed: Set<string>;
  can: (widgetId: string) => boolean;
  restrictedCount: (candidates: string[]) => number;
}

/** Client-side mirror of the database rules, used only to hide what is denied. */
export function useWidgetAccess(): WidgetAccess {
  const query = useQuery(allowedWidgetsQuery);
  const allowed = new Set(query.data ?? []);
  // Until the rules load, render nothing restricted-looking: treat as allowed
  // only once the answer is known, so we never flash a forbidden widget.
  const can = (widgetId: string) => (query.isSuccess ? allowed.has(widgetId) : false);
  return {
    isLoading: query.isLoading,
    allowed,
    can,
    restrictedCount: (candidates) => candidates.filter((id) => !can(id)).length,
  };
}

/** Widget id encoded in a ConversationIQ deep link (`command-centre:<widget>`). */
export function widgetFromDeepLink(from: string | undefined): string | undefined {
  if (!from || !from.startsWith("command-centre")) return undefined;
  const [, widget] = from.split(":");
  return widget || undefined;
}
