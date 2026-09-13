import { InvalidCredentialsError } from "../domain/errors";
import type { Login, LoginCommand, LoginResult } from "../ports/inbound/login";
import type { AuthPort } from "../ports/outbound/auth-port";
import type { UserRepository } from "../ports/outbound/user-repository";

export interface LoginDeps {
  readonly auth: AuthPort;
  readonly users: UserRepository;
}

export class LoginUseCase implements Login {
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
    };
  }
}
