import { clientOrganisationId } from "../domain/client-organisation";
import {
  coordinatorContextFor,
  coordinatorLeadContextFor,
  homeWorkspaceFor,
  organiserContextFor,
  safetyOfficerContextFor,
  technicalSupportContextFor,
  workspacesFor,
  type StaffMember,
  type StaffWorkspace,
} from "../domain/staff-member";
import { userAccountId } from "../domain/user-account";
import type { AuthPort } from "../ports/outbound/auth-port";
import type { UserRepository } from "../ports/outbound/user-repository";

export interface IdentifyStaffMemberResult {
  /** The member of staff's own name, whatever their role. */
  readonly name: string;
  /** The member of staff's own user account, whatever their role -- who notifications go to. */
  readonly userAccountId: string;
  /** Who the Organiser's screens act as -- null unless `organiserContextFor` allows it. */
  readonly organiser: {
    readonly userAccountId: string;
    readonly clientOrganisationId: string;
    readonly name: string;
  } | null;
  /** Who the Coordinator's screens act as -- null unless `coordinatorContextFor` allows it. */
  readonly coordinator: { readonly userAccountId: string; readonly name: string } | null;
  /** Who Technical Support's screens act as -- null unless `technicalSupportContextFor` allows it. */
  readonly technicalSupport: { readonly userAccountId: string } | null;
  /** Who the Safety Officer's screens act as -- null unless `safetyOfficerContextFor` allows it. */
  readonly safetyOfficer: { readonly userAccountId: string } | null;
  /** Who the Event Coordinator Lead's screens act as -- null unless `coordinatorLeadContextFor` allows it. */
  readonly coordinatorLead: { readonly userAccountId: string } | null;
  /** The staff workspaces the member may open -- see `workspacesFor`. */
  readonly workspaces: readonly StaffWorkspace[];
  /** Where an access-denied screen sends them back to -- see `homeWorkspaceFor`. */
  readonly homeWorkspace: StaffWorkspace | null;
}

export interface IdentifyStaffMemberDeps {
  readonly auth: AuthPort;
  readonly users: UserRepository;
}

/** The signed-in member of staff, and who each role's screens may act as. */
export class IdentifyStaffMemberUseCase {
  constructor(private readonly deps: IdentifyStaffMemberDeps) {}

  /** Null when nobody is signed in, or the signed-in auth user has no user account. */
  async execute(): Promise<IdentifyStaffMemberResult | null> {
    const session = await this.deps.auth.getSession();
    if (session === null) {
      return null;
    }

    const user = await this.deps.users.findByAuthUserId(session.userId);
    if (user === null) {
      return null;
    }

    const member: StaffMember = {
      userAccountId: userAccountId(user.userId),
      roles: user.roles,
      clientOrganisationId:
        user.clientOrganisationId === null ? null : clientOrganisationId(user.clientOrganisationId),
    };
    const organiser = organiserContextFor(member);
    const coordinator = coordinatorContextFor(member);
    const technicalSupport = technicalSupportContextFor(member);

    return {
      name: user.name,
      userAccountId: member.userAccountId,
      organiser: organiser && { ...organiser, name: user.name },
      coordinator: coordinator && { ...coordinator, name: user.name },
      technicalSupport,
      safetyOfficer: safetyOfficerContextFor(member),
      coordinatorLead: coordinatorLeadContextFor(member),
      workspaces: workspacesFor(member.roles),
      homeWorkspace: homeWorkspaceFor(member),
    };
  }
}
