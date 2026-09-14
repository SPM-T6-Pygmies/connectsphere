export interface LogoutInput {
  /** The caller's `user_account_id`; `null` when they have no user account. */
  userId: string | null;
}

export interface Logout {
  execute(input: LogoutInput): Promise<void>;
}
