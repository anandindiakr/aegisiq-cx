/**
 * Alert triage permissions.
 *
 * Two gates apply to every triage action:
 *  1. Capability — does the signed-in user's role allow acknowledge / resolve /
 *     dismiss / assign at all (see the ConversationIQ capability matrix, which
 *     role templates can override).
 *  2. Outlet scope — outlet managers and supervisors may only act on alerts for
 *     the outlet on their profile. Admins and regional managers are estate-wide.
 *
 * The same rules are enforced in the database by `can_triage_alert()` on the
 * alerts UPDATE policy; this module keeps the UI honest so nobody is offered a
 * button that row-level security will reject.
 */
import { useQuery } from "@tanstack/react-query";

import { myProfileQuery, myRolesQuery } from "@/features/platform/queries";
import type { AppRole } from "@/features/platform/queries";
import { useIqAccess, type IqCapability } from "@/features/conversationiq/access";

export type AlertAction = "acknowledge" | "resolve" | "dismiss" | "assign";

const ACTION_CAPABILITY: Record<AlertAction, IqCapability> = {
  acknowledge: "alertAcknowledge",
  resolve: "alertResolve",
  dismiss: "alertDismiss",
  assign: "alertAssign",
};

export const ACTION_LABELS: Record<AlertAction, string> = {
  acknowledge: "Acknowledge",
  resolve: "Resolve",
  dismiss: "Dismiss",
  assign: "Assign owner",
};

const ESTATE_WIDE: AppRole[] = ["super_admin", "tenant_admin", "regional_manager"];

export interface AlertAccess {
  roles: AppRole[];
  isLoading: boolean;
  /** True when the user's remit covers every outlet. */
  estateWide: boolean;
  /** Outlet the user is scoped to, when they are not estate-wide. */
  scopedOutletId: string | null;
  can: (action: AlertAction) => boolean;
  canManageSla: boolean;
  canViewAnalytics: boolean;
  /** Capability plus outlet-scope check for a specific alert. */
  canActOn: (action: AlertAction, outletId: string | null) => boolean;
  /** Human-readable reason an action is unavailable, for tooltips. */
  denyReason: (action: AlertAction, outletId: string | null) => string | null;
}

export function useAlertAccess(): AlertAccess {
  const iq = useIqAccess();
  const roles = useQuery(myRolesQuery);
  const profile = useQuery(myProfileQuery);

  const list = roles.data ?? [];
  const estateWide = list.some((role) => ESTATE_WIDE.includes(role));
  const scopedOutletId = estateWide ? null : (profile.data?.outlet_id ?? null);

  const inScope = (outletId: string | null) => {
    if (estateWide) return true;
    // A profile without an outlet is a floating operator: treat as estate-wide
    // reads but keep estate-level (unassigned) alerts actionable for everyone.
    if (!scopedOutletId) return true;
    if (!outletId) return true;
    return outletId === scopedOutletId;
  };

  const can = (action: AlertAction) => iq.can(ACTION_CAPABILITY[action]);

  return {
    roles: list,
    isLoading: iq.isLoading || roles.isLoading || profile.isLoading,
    estateWide,
    scopedOutletId,
    can,
    canManageSla: iq.can("manageAlertSla"),
    canViewAnalytics: iq.can("viewAlertAnalytics"),
    canActOn: (action, outletId) => can(action) && inScope(outletId),
    denyReason: (action, outletId) => {
      if (!can(action)) return `Your role cannot ${ACTION_LABELS[action].toLowerCase()} alerts.`;
      if (!inScope(outletId)) return "This alert belongs to another outlet.";
      return null;
    },
  };
}
