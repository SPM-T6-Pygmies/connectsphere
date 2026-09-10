export interface LoginCommand {
  readonly email: string;
  readonly password: string;
}

export interface LoginResult {
  readonly userId: string;
  readonly roles: string[];
  readonly expiresAt: string;
}

export interface Login {
  execute(command: LoginCommand): Promise<LoginResult>;
}
