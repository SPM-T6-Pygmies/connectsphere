import { InvalidCredentialsError } from "../domain/errors";
import { landingWorkspaceFor, type StaffWorkspace } from "../domain/staff-member";
import type { AuthPort } from "../ports/outbound/auth-port";
import type { UserRepository } from "../ports/outbound/user-repository";

export interface LoginCommand {
  readonly email: string;
  readonly password: string;
}

export interface LoginResult {
  readonly userId: string;
  readonly roles: string[];
  readonly expiresAt: string;
  /** Where to send them now -- null when they have no staff role to land in (`landingWorkspaceFor`). */
  readonly landingWorkspace: StaffWorkspace | null;
}

export interface LoginDeps {
  readonly auth: AuthPort;
  readonly users: UserRepository;
}

export class LoginUseCase {
  constructor(private readonly deps: LoginDeps) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const { auth, users } = this.deps;

    let authResult;
    try {
      authResult = await auth.login(command.email, command.password);
    } catch {
      throw new InvalidCredentialsError();
    }

    const user = await users.findByAuthUserId(authResult.userId);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    return {
      userId: user.userId,
      roles: user.roles,
      expiresAt: authResult.expiresAt.toISOString(),
      landingWorkspace: landingWorkspaceFor(user.roles),
    };
  }
}
