import type { AuthPort, LoginResult, SessionData } from "@/core/ports/outbound/auth-port";

/** A login the fake auth service accepts, and the session it starts. */
export interface SeedCredentials {
  readonly email: string;
  readonly password: string;
  readonly authUserId: string;
  readonly expiresAt: Date;
}

export class InMemoryAuth implements AuthPort {
  private readonly credentials: readonly SeedCredentials[];
  private session: SessionData | null;

  constructor(
    seed: {
      readonly credentials?: readonly SeedCredentials[];
      /** Who is already signed in, if anyone. */
      readonly session?: SessionData | null;
    } = {},
  ) {
    this.credentials = seed.credentials ?? [];
    this.session = seed.session ?? null;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const match = this.credentials.find(
      (candidate) => candidate.email === email && candidate.password === password,
    );
    if (match === undefined) {
      throw new Error("Invalid email or password");
    }

    this.session = { userId: match.authUserId, expiresAt: match.expiresAt };
    return this.session;
  }

  async getSession(): Promise<SessionData | null> {
    return this.session;
  }

  async logout(): Promise<void> {
    this.session = null;
  }
}
