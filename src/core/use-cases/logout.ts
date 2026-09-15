import type { AuthPort } from "../ports/outbound/auth-port";
import type { AuditLogger } from "../ports/outbound/audit-logger";

export interface LogoutDeps {
  readonly auth: AuthPort;
  readonly auditLogger: AuditLogger;
}

export interface LogoutInput {
  /** The caller's `user_account_id`; `null` when they have no user account. */
  userId: string | null;
}

export class LogoutUseCase {
  constructor(private readonly deps: LogoutDeps) {}

  async execute(input: LogoutInput): Promise<void> {
    await this.deps.auth.logout();
    // An audit record must point at a user account; without one there is
    // nothing to attribute the logout to, but the session still ends.
    if (input.userId !== null) {
      await this.deps.auditLogger.logLogout(input.userId);
    }
  }
}
