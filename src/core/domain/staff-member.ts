import type { ClientOrganisationId } from "./client-organisation";
import type { CoordinatorContext, OrganiserContext } from "./event-request";
import type { UserAccountId } from "./user-account";

export type StaffWorkspace = "requester" | "coordinator" | "ops" | "venue" | "technical" | "safety";

/** Where each staff role works, keyed by the role's name as the `role` table spells it. */
const WORKSPACE_BY_ROLE: ReadonlyMap<string, StaffWorkspace> = new Map([
  ["Event Organiser", "requester"],
  ["Event Coordinator", "coordinator"],
  ["Event Operations Manager", "ops"],
  ["Venue Staff", "venue"],
  ["Technical Support Staff", "technical"],
  ["Safety Officer", "safety"],
]);

/**
 * The role that owns each workspace's page area -- the one a user denied a
 * page there is told to contact (SPM-16). Read off the same table, so a
 * workspace can never be owned by a role that does not work in it.
 */
const OWNER_BY_WORKSPACE: ReadonlyMap<StaffWorkspace, string> = new Map(
  [...WORKSPACE_BY_ROLE].map(([role, workspace]) => [workspace, role]),
);

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
 * The workspaces a member of staff may open: one for each staff role they
 * hold. A role that is not a staff role opens none.
 */
export function workspacesFor(roles: readonly string[]): StaffWorkspace[] {
  return roles.flatMap((role) => {
    const workspace = WORKSPACE_BY_ROLE.get(role);
    return workspace === undefined ? [] : [workspace];
  });
}

/**
 * True when a signed-in user holds no staff role at all, so there is no page
 * area they could have been denied from and nowhere in /staff to send them
 * back to (SPM-192). Login already refuses this account (`NoStaffRoleError`)
 * -- this is the backstop for a session that reaches /staff some other way,
 * e.g. a role changed after the session was issued.
 */
export function hasNoStaffWorkspace(workspaces: readonly StaffWorkspace[]): boolean {
  return workspaces.length === 0;
}

/**
 * True when a staff member holds a real staff role but has nowhere to land
 * -- today only an Event Organiser with no client organisation (SPM-188).
 * A broken account, not a genuine access question: distinct from
 * `hasNoStaffWorkspace`, which is no staff role at all.
 */
export function isStaffWithNoHome(
  workspaces: readonly StaffWorkspace[],
  homeWorkspace: StaffWorkspace | null,
): boolean {
  return !hasNoStaffWorkspace(workspaces) && homeWorkspace === null;
}

/**
 * Who to contact about a page in this workspace's area: the role that owns
 * it, never an individual (SPM-16 AC4).
 */
export function pageAreaOwner(area: StaffWorkspace): string {
  return OWNER_BY_WORKSPACE.get(area)!;
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

/** Who a member of staff acts as on Technical Support's screens. */
export interface TechnicalSupportContext {
  readonly userAccountId: UserAccountId;
}

/** Who a member of staff acts as on Technical Support's screens: only Technical Support Staff (SPM-41 AC16). */
export function technicalSupportContextFor(member: StaffMember): TechnicalSupportContext | null {
  if (!member.roles.includes("Technical Support Staff")) {
    return null;
  }

  return { userAccountId: member.userAccountId };
}

/** Who a member of staff acts as on the Safety Officer's screens. */
export interface SafetyOfficerContext {
  readonly userAccountId: UserAccountId;
}

/** Who a member of staff acts as on the Safety Officer's screens: only a Safety Officer (SPM-259 AC7). */
export function safetyOfficerContextFor(member: StaffMember): SafetyOfficerContext | null {
  if (!member.roles.includes("Safety Officer")) {
    return null;
  }

  return { userAccountId: member.userAccountId };
}

/**
 * Where a member of staff denied a page is sent back to: their landing
 * workspace, provided they can actually open it (SPM-16 AC5). An Organiser
 * with no client organisation lands on requester but is refused every page
 * there, so they have nowhere to go -- the same as someone with no staff role.
 */
export function homeWorkspaceFor(member: StaffMember): StaffWorkspace | null {
  const landing = landingWorkspaceFor(member.roles);
  if (landing === "requester" && organiserContextFor(member) === null) {
    return null;
  }

  return landing;
}

/** Who a member of staff acts as on the Coordinator's screens: only an Event Coordinator. */
export function coordinatorContextFor(member: StaffMember): CoordinatorContext | null {
  if (!member.roles.includes("Event Coordinator")) {
    return null;
  }

  return { userAccountId: member.userAccountId };
}
