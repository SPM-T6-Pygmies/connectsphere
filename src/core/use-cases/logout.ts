import type { Logout } from "../ports/inbound/logout";
import type { AuthPort } from "../ports/outbound/auth-port";

export interface LogoutDeps {
  readonly auth: AuthPort;
}

export class LogoutUseCase implements Logout {
  constructor(private readonly deps: LogoutDeps) {}

  async execute(): Promise<void> {
    await this.deps.auth.logout();
  }
}
