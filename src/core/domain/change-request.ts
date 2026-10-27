import { isCalendarDate } from "./booking";
import type { CoordinatorEventStatus } from "./coordinator-event";
import {
  ChangeRequestAlreadyOpenError,
  ChangeRequestClosedError,
  DomainError,
  EventRequestNotFoundError,
  InvalidChangeRequestError,
} from "./errors";
import type { EventId } from "./event";
import { chooseRegistrationSettings, type RegistrationSettings } from "./event-registration-settings";
import type { TimeRangeOnDate } from "./event-times";
import { END_OF_DAY, isOnGrid, overlaps, toMinutes } from "./time-of-day";
import type { UserAccountId } from "./user-account";

/**
 * SPM-52: the event's owning Organiser asks its Coordinator to change one or
 * more significant fields, each with the value they want (#104). The
 * Coordinator decides each field on its own (SPM-100).
 */

/** The significant fields (#4). Programme, agenda and the rest are not change-request fields. */
export const CHANGE_REQUEST_FIELDS = [
  "times",
  "venue_requirements",
  "expected_attendance",
  "equipment_requirements",
  "registration",
] as const;

export type ChangeRequestField = (typeof CHANGE_REQUEST_FIELDS)[number];

/**
 * One field and the value asked for. `null` is "Not applicable", which only
 * equipment and registration may ask for: no equipment, or a closed-door event
 * with no registration (2026-10-18 team decision).
 */
export type RequestedChange =
  | { readonly field: "times"; readonly value: readonly TimeRangeOnDate[] }
  | { readonly field: "venue_requirements"; readonly value: string }
  | { readonly field: "expected_attendance"; readonly value: number }
  | { readonly field: "equipment_requirements"; readonly value: string | null }
  | { readonly field: "registration"; readonly value: RegistrationSettings | null };

/** What deciding whether a change request may be submitted needs to know about the event. */
export interface ChangeRequestTarget {
  readonly eventId: EventId;
  readonly status: CoordinatorEventStatus;
  readonly owningOrganiserUserAccountId: UserAccountId;
  readonly hasOpenChangeRequest: boolean;
}

/**
 * Where the Organiser stands: `none` when there is no event they own (treated
 * as not found, #91), `closed` once it is Completed or Cancelled, `open` while
 * a request waits on the Coordinator, otherwise `available`. A Confirmed event
 * is still `available`: there is no cut-off before the event date (#8).
 */
export type ChangeRequestState = "none" | "closed" | "open" | "available";

export function changeRequestStateFor(
  target: ChangeRequestTarget | null,
  organiser: UserAccountId,
): ChangeRequestState {
  if (target === null || target.owningOrganiserUserAccountId !== organiser) {
    return "none";
  }
  if (target.status === "Completed" || target.status === "Cancelled") {
    return "closed";
  }
  return target.hasOpenChangeRequest ? "open" : "available";
}

/** Throws unless `organiser` may submit a change request on `target` now. */
export function assertCanSubmitChangeRequest(
  target: ChangeRequestTarget | null,
  organiser: UserAccountId,
  eventRequestId: string,
): asserts target is ChangeRequestTarget {
  const state = changeRequestStateFor(target, organiser);
  if (state === "none" || target === null) {
    throw new EventRequestNotFoundError(eventRequestId);
  }
  if (state === "closed") {
    throw new ChangeRequestClosedError(target.status);
  }
  if (state === "open") {
    throw new ChangeRequestAlreadyOpenError();
  }
}

/**
 * The changes to store, or why they cannot be: at least one field, each at
 * most once, each with a value it can take. Text is trimmed.
 */
export function chooseRequestedChanges(changes: readonly RequestedChange[]): RequestedChange[] {
  if (changes.length === 0) {
    throw new InvalidChangeRequestError(null, "Choose at least one thing to change.");
  }
  const seen = new Set<ChangeRequestField>();
  return changes.map((change) => {
    if (seen.has(change.field)) {
      throw new InvalidChangeRequestError(change.field, "Each field can be asked for only once.");
    }
    seen.add(change.field);
    return chooseValue(change);
  });
}

function chooseValue(change: RequestedChange): RequestedChange {
  switch (change.field) {
    case "times":
      return { field: "times", value: chooseTimes(change.value) };
    case "venue_requirements":
      return { field: "venue_requirements", value: requiredText(change.field, change.value) };
    case "expected_attendance":
      if (!Number.isInteger(change.value) || change.value < 0) {
        throw new InvalidChangeRequestError(change.field, "Expected attendance must be a whole number, 0 or more.");
      }
      return change;
    case "equipment_requirements":
      return {
        field: "equipment_requirements",
        value: change.value === null ? null : requiredText(change.field, change.value),
      };
    case "registration":
      return { field: "registration", value: change.value === null ? null : chooseRegistration(change.value) };
  }
}

function requiredText(field: ChangeRequestField, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new InvalidChangeRequestError(field, "Say what you need.");
  }
  return trimmed;
}

/** The registration rules are the Coordinator's own (`chooseRegistrationSettings`), pointed at this field. */
function chooseRegistration(value: RegistrationSettings): RegistrationSettings {
  try {
    return chooseRegistrationSettings(value);
  } catch (error) {
    if (error instanceof DomainError) {
      throw new InvalidChangeRequestError("registration", error.message);
    }
    throw error;
  }
}

/**
 * The event's new times, in date then start order: real dates, on the
 * 15-minute grid, each ending after it starts, none overlapping another on the
 * same date. There are no session times (2026-10-18 team decision).
 */
function chooseTimes(ranges: readonly TimeRangeOnDate[]): TimeRangeOnDate[] {
  if (ranges.length === 0) {
    throw new InvalidChangeRequestError("times", "Add at least one date and time.");
  }
  const ordered = [...ranges].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  let previous: { readonly date: string; readonly start: number; readonly end: number } | null = null;
  for (const range of ordered) {
    if (!isCalendarDate(range.date)) {
      throw new InvalidChangeRequestError("times", `${range.date} is not a date -- enter it as YYYY-MM-DD.`);
    }
    const start = toMinutes(range.start);
    const end = toMinutes(range.end);
    if (start === null || start >= END_OF_DAY || !isOnGrid(start) || end === null || !isOnGrid(end)) {
      throw new InvalidChangeRequestError("times", "Choose times on the quarter hour, from 00:00 to 24:00.");
    }
    if (end <= start) {
      throw new InvalidChangeRequestError("times", "Each end time must be after its start time.");
    }
    if (previous !== null && previous.date === range.date && overlaps(previous, { start, end })) {
      throw new InvalidChangeRequestError("times", `Two times on ${range.date} overlap.`);
    }
    previous = { date: range.date, start, end };
  }
  return ordered.map(({ date, start, end }) => ({ date, start, end }));
}
