import type { ClientOrganisationId } from "./client-organisation";
import type { CoordinatorContext, OrganiserContext } from "./event-request";
import type { UserAccountId } from "./user-account";

export type StaffWorkspace = "requester" | "coordinator" | "ops" | "venue" | "technical";

/** Where each staff role works, keyed by the role's name as the `role` table spells it. */
const WORKSPACE_BY_ROLE: ReadonlyMap<string, StaffWorkspace> = new Map([
  ["Event Organiser", "requester"],
  ["Event Coordinator", "coordinator"],
  ["Event Operations Manager", "ops"],
  ["Venue Staff", "venue"],
  ["Technical Support Staff", "technical"],
]);

/** A signed-in member of staff, as far as deciding what they may act as goes. */
export interface StaffMember {
  readonly userAccountId: UserAccountId;
  readonly roles: readonly string[];
  /** Set only for Event Organisers who belong to a client organisation. */
  readonly clientOrganisationId: ClientOrganisationId | null;
}

/**
 * Where a member of staff lands after signing in: the workspace of their
 * first role. Null when they have no role, or the first is not a staff role.
 */
export function landingWorkspaceFor(roles: readonly string[]): StaffWorkspace | null {
  const [primary] = roles;
  return primary === undefined ? null : (WORKSPACE_BY_ROLE.get(primary) ?? null);
}

/**
 * Who a member of staff acts as on the Organiser's screens: only an Event
 * Organiser, and only one with a client organisation to act for -- every
 * request an Organiser can see or raise is scoped to it.
 */
export function organiserContextFor(member: StaffMember): OrganiserContext | null {
  if (!member.roles.includes("Event Organiser") || member.clientOrganisationId === null) {
    return null;
  }

  return {
    userAccountId: member.userAccountId,
    clientOrganisationId: member.clientOrganisationId,
  };
}

/** Who a member of staff acts as on the Coordinator's screens: only an Event Coordinator. */
export function coordinatorContextFor(member: StaffMember): CoordinatorContext | null {
  if (!member.roles.includes("Event Coordinator")) {
    return null;
  }

  return { userAccountId: member.userAccountId };
}
