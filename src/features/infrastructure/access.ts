/**
 * Granular infrastructure permissions.
 *
 * The database is the enforcement point (`public.infra_can` guards the RPCs and
 * RLS policies). This module mirrors the same matrix client-side so the UI can
 * disable actions a person cannot perform instead of failing them mid-click.
 */
import { useQuery } from "@tanstack/react-query";

import { myRolesQuery } from "@/features/platform/queries";
import type { AppRole } from "@/features/platform/queries";

export type InfraRight =
  /** See device listings, telemetry and change history. */
  | "view"
  /** Know that credentials exist and open the vault dialog read-only. */
  | "viewCredentials"
  /** Decrypt a stored secret (always audited). */
  | "revealCredentials"
  /** Store or rotate a secret. */
  | "manageCredentials"
  /** Ask an admin to rotate a credential. */
  | "requestRotation"
  /** Enable/disable devices, services and engine configuration. */
  | "operate"
  /** Retire or decommission a device. */
  | "decommission"
  /** Edit health thresholds that raise automated alerts. */
  | "configureThresholds";

const ADMIN: AppRole[] = ["super_admin", "tenant_admin"];
const OPERATORS: AppRole[] = [...ADMIN, "regional_manager", "outlet_manager", "supervisor"];

const MATRIX: Record<InfraRight, AppRole[] | "any"> = {
  view: "any",
  viewCredentials: OPERATORS,
  revealCredentials: ADMIN,
  manageCredentials: ADMIN,
  requestRotation: "any",
  operate: OPERATORS,
  decommission: [...ADMIN, "regional_manager"],
  configureThresholds: ADMIN,
};

export interface InfraAccess {
  isLoading: boolean;
  roles: AppRole[];
  can: (right: InfraRight) => boolean;
}

export function useInfraAccess(): InfraAccess {
  const { data, isPending } = useQuery(myRolesQuery);
  const roles = data ?? [];
  return {
    isLoading: isPending,
    roles,
    can: (right) => {
      const allowed = MATRIX[right];
      if (allowed === "any") return roles.length > 0;
      return roles.some((role) => allowed.includes(role));
    },
  };
}

/** Human wording for a denied action, used in tooltips and toasts. */
export const RIGHT_DENIED: Record<InfraRight, string> = {
  view: "Your role cannot view infrastructure devices.",
  viewCredentials: "Your role cannot see the credential vault.",
  revealCredentials: "Only workspace admins can decrypt stored credentials.",
  manageCredentials: "Only workspace admins can store or rotate credentials.",
  requestRotation: "Your role cannot request credential rotations.",
  operate: "Your role cannot enable or disable devices and services.",
  decommission: "Only regional managers and admins can decommission devices.",
  configureThresholds: "Only workspace admins can change health thresholds.",
};
