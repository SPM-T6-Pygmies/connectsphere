import type { Logout } from "../ports/inbound/logout";
import type { AuthPort } from "../ports/outbound/auth-port";
import type { AuditLogger } from "../ports/outbound/audit-logger";

export interface LogoutDeps {
  readonly auth: AuthPort;
  readonly auditLogger: AuditLogger;
}

export interface LogoutInput {
  userId: string;
}

export class LogoutUseCase implements Logout {
  constructor(private readonly deps: LogoutDeps) {}

  async execute(input: LogoutInput): Promise<void> {
    await this.deps.auth.logout();
    await this.deps.auditLogger.logLogout(input.userId);
  }
}
