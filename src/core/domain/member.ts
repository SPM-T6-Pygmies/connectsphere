import type { Brand } from "./brand";
import { InvalidMemberIdError } from "./errors";

export type MemberId = Brand<string, "MemberId">;

/**
 * The only way to obtain a `MemberId`.
 *
 * Smart constructors are what let the rest of the core stop defending itself:
 * once a value is a `MemberId`, it is known non-empty, and no function
 * downstream has to re-check.
 */
export function memberId(raw: string): MemberId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidMemberIdError(raw);
  }
  return trimmed as MemberId;
}
