export interface LogoutInput {
  userId: string;
}

export interface Logout {
  execute(input: LogoutInput): Promise<void>;
}
