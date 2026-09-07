import type { Brand } from "./brand";
import { InvalidAttendeeEmailError, InvalidAttendeeNameError } from "./errors";

export type AttendeeName = Brand<string, "AttendeeName">;
export type AttendeeEmail = Brand<string, "AttendeeEmail">;

export function attendeeName(raw: string): AttendeeName {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidAttendeeNameError();
  }
  return trimmed as AttendeeName;
}

/**
 * Normalises as well as validates: an email is the same email whatever its
 * case, so lower-casing here is what makes "already registered" match
 * consistently everywhere downstream, including the database's unique index.
 *
 * There is deliberately no pattern check. Whether a string *looks like* an
 * address is a shape question, and shape is validated at the boundary by zod.
 * The core enforces rules, not formats.
 */
export function attendeeEmail(raw: string): AttendeeEmail {
  const normalised = raw.trim().toLowerCase();
  if (normalised.length === 0) {
    throw new InvalidAttendeeEmailError();
  }
  return normalised as AttendeeEmail;
}
