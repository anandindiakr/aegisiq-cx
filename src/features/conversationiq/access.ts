import { useQuery } from "@tanstack/react-query";

import { myRolesQuery, type AppRole } from "@/features/platform/queries";

/**
 * ConversationIQ™ role-based access control.
 *
 * Row-level security in the database is the enforcement point; this module is
 * the matching capability model for the UI so reviewers never see an action
 * their role cannot complete. Capabilities are derived from the roles granted
 * in `user_roles` (which the SSO claim mappings keep in sync).
 */

export type IqCapability =
  | "viewTranscripts"
  | "editNotesTags"
  | "editAnchors"
  | "moveQueue"
  | "assignQueue"
  | "reviewAlerts"
  | "exportCompliance"
  | "viewAudit";

const MATRIX: Record<IqCapability, AppRole[]> = {
  viewTranscripts: [
    "super_admin",
    "tenant_admin",
    "regional_manager",
    "outlet_manager",
    "supervisor",
  ],
  editNotesTags: [
    "super_admin",
    "tenant_admin",
    "regional_manager",
    "outlet_manager",
    "supervisor",
  ],
  editAnchors: ["super_admin", "tenant_admin", "regional_manager", "outlet_manager", "supervisor"],
  moveQueue: ["super_admin", "tenant_admin", "regional_manager", "outlet_manager", "supervisor"],
  assignQueue: ["super_admin", "tenant_admin", "regional_manager", "outlet_manager"],
  reviewAlerts: ["super_admin", "tenant_admin", "regional_manager", "outlet_manager", "supervisor"],
  exportCompliance: ["super_admin", "tenant_admin", "regional_manager"],
  viewAudit: ["super_admin", "tenant_admin", "regional_manager"],
};

export const CAPABILITY_LABELS: Record<IqCapability, string> = {
  viewTranscripts: "View transcripts",
  editNotesTags: "Add notes and tags",
  editAnchors: "Create and edit transcript anchors",
  moveQueue: "Move queue items",
  assignQueue: "Assign reviewers",
  reviewAlerts: "Acknowledge and resolve alerts",
  exportCompliance: "Export compliance packs",
  viewAudit: "View the audit trail",
};

export function can(roles: AppRole[] | undefined, capability: IqCapability) {
  if (!roles || roles.length === 0) return false;
  return roles.some((role) => MATRIX[capability].includes(role));
}

export interface IqAccess {
  roles: AppRole[];
  isLoading: boolean;
  can: (capability: IqCapability) => boolean;
}

/** Capability lookup for the signed-in reviewer. */
export function useIqAccess(): IqAccess {
  const roles = useQuery(myRolesQuery);
  const list = roles.data ?? [];
  return {
    roles: list,
    isLoading: roles.isLoading,
    can: (capability: IqCapability) => can(list, capability),
  };
}
