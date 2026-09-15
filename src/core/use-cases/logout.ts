import type { AuthPort } from "../ports/outbound/auth-port";
import type { AuditLogger } from "../ports/outbound/audit-logger";
import type { UserRepository } from "../ports/outbound/user-repository";

export interface LogoutDeps {
  readonly auth: AuthPort;
  readonly users: UserRepository;
  readonly auditLogger: AuditLogger;
}

export class LogoutUseCase {
  constructor(private readonly deps: LogoutDeps) {}

  /** Ends the caller's session, if they have one, and records which user account signed out. */
  async execute(): Promise<void> {
    const session = await this.deps.auth.getSession();
    if (session === null) {
      return;
    }

    // Looked up before signing out: afterwards there is no session to ask.
    const user = await this.deps.users.findByAuthUserId(session.userId);

    await this.deps.auth.logout();
    // An audit record must point at a user account; without one there is
    // nothing to attribute the logout to, but the session still ends.
    if (user !== null) {
      await this.deps.auditLogger.logLogout(user.userId);
    }
  }
}
