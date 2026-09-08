import type { Brand } from "./brand";
import { InvalidUserAccountIdError } from "./errors";

export type UserAccountId = Brand<string, "UserAccountId">;

/**
 * The only way to obtain a `UserAccountId`.
 *
 * Deliberately not `MemberId`: a `Member` is the connections feature's social
 * identity, while a `UserAccountId` identifies an Event Organiser or Event
 * Coordinator (wiki: user-account, #56). They happen to both be strings today,
 * which is exactly the kind of mix-up branding exists to prevent -- not a
 * reason to reuse one for the other.
 */
export function userAccountId(raw: string): UserAccountId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidUserAccountIdError(raw);
  }
  return trimmed as UserAccountId;
}
