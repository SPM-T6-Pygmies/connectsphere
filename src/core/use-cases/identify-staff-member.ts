import { clientOrganisationId } from "../domain/client-organisation";
import {
  coordinatorContextFor,
  organiserContextFor,
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
  /** Who the Organiser's screens act as -- null unless `organiserContextFor` allows it. */
  readonly organiser: {
    readonly userAccountId: string;
    readonly clientOrganisationId: string;
    readonly name: string;
  } | null;
  /** Who the Coordinator's screens act as -- null unless `coordinatorContextFor` allows it. */
  readonly coordinator: { readonly userAccountId: string } | null;
  /** The staff workspaces the member may open -- see `workspacesFor`. */
  readonly workspaces: readonly StaffWorkspace[];
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

    return {
      name: user.name,
      organiser: organiser && { ...organiser, name: user.name },
      coordinator: coordinatorContextFor(member),
      workspaces: workspacesFor(member.roles),
    };
  }
}
