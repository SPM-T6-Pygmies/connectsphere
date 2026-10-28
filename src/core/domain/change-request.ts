import { isCalendarDate } from "./booking";
import type { Brand } from "./brand";
import type { CoordinatorEventStatus } from "./coordinator-event";
import {
  ChangeRequestAlreadyDecidedError,
  ChangeRequestAlreadyOpenError,
  ChangeRequestClosedError,
  ChangeRequestNotFoundError,
  DomainError,
  EventRequestNotFoundError,
  InvalidChangeRequestDecisionError,
  InvalidChangeRequestError,
} from "./errors";
import type { EventId } from "./event";
import type { ArrangementType } from "./event-readiness";
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

// ---------------------------------------------------------------------------
// SPM-100: the assigned Coordinator decides each field
// ---------------------------------------------------------------------------

export type ChangeRequestId = Brand<string, "ChangeRequestId">;

/** A blank id names no request, so it is not found rather than invalid (#91). */
export function changeRequestId(raw: string): ChangeRequestId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ChangeRequestNotFoundError(raw);
  }
  return trimmed as ChangeRequestId;
}

/** Where one field stands. The store spells "Declined" `Rejected`. */
export type ItemDecisionState = "Pending" | "Accepted" | "Declined";

export interface ChangeRequestItem {
  readonly change: RequestedChange;
  readonly decision: ItemDecisionState;
  /** Why it was declined; null unless it was. */
  readonly reason: string | null;
}

export interface ChangeRequest {
  readonly id: ChangeRequestId;
  readonly submittedAt: Date;
  readonly items: readonly ChangeRequestItem[];
}

/** Not stored: Pending while any item is, Decided once every one is (2026-10-18 team decision). */
export function changeRequestStatus(request: ChangeRequest): "Pending" | "Decided" {
  return request.items.some((item) => item.decision === "Pending") ? "Pending" : "Decided";
}

/** The Coordinator's call on one field. A decline needs a reason (#104). */
export type ItemDecision =
  | { readonly field: ChangeRequestField; readonly outcome: "Accepted" }
  | { readonly field: ChangeRequestField; readonly outcome: "Declined"; readonly reason: string };

/**
 * What an accepted change makes someone check again. Bookings are flagged for
 * a change of times, attendance or venue needs (SPM-309); reserved equipment
 * goes under review only when the event's dates change (SPM-311). A revised
 * equipment need is only recorded: the Coordinator edits the lines, which puts
 * them under review (2026-10-18 team decision).
 */
export interface Revalidation {
  readonly bookingFlagFields: readonly ChangeRequestField[];
  readonly equipmentReview: boolean;
}

export interface ChangeRequestDecision {
  /** Every item, now decided, in the request's order. */
  readonly items: readonly ChangeRequestItem[];
  /** Arrangements accepted as Not applicable: no longer essential, so not required for confirmation. */
  readonly notEssential: readonly ArrangementType[];
  readonly revalidation: Revalidation;
  /** An accepted change of times is the reschedule (SPM-54 is cancelled). */
  readonly rescheduled: boolean;
}

const FLAGS_BOOKINGS: readonly ChangeRequestField[] = ["times", "expected_attendance", "venue_requirements"];

/**
 * Throws unless the caller may decide `request` now: the event is assigned to
 * them (`event` is null otherwise) and is not yet Completed or Cancelled.
 */
export function assertCanDecideChangeRequest(
  event: { readonly status: CoordinatorEventStatus } | null,
  request: ChangeRequest | null,
  id: string,
): asserts request is ChangeRequest {
  if (event === null || request === null) {
    throw new ChangeRequestNotFoundError(id);
  }
  if (event.status === "Completed" || event.status === "Cancelled") {
    throw new ChangeRequestClosedError(event.status);
  }
}

/**
 * Decides every item at once (2026-10-18 team decision), or says why not:
 * the request is already decided, a decision names a field the request does
 * not cover or names one twice, an item is left undecided, or a decline has no
 * reason. Reasons are trimmed.
 *
 * `currentTimes` are the event's times now, so a change of time on the same
 * dates can be told from a change of date (SPM-311 AC4).
 */
export function decideChangeRequest(
  request: ChangeRequest,
  decisions: readonly ItemDecision[],
  currentTimes: readonly TimeRangeOnDate[],
): ChangeRequestDecision {
  if (changeRequestStatus(request) === "Decided") {
    throw new ChangeRequestAlreadyDecidedError();
  }

  const byField = new Map<ChangeRequestField, ItemDecision>();
  for (const decision of decisions) {
    if (!request.items.some((item) => item.change.field === decision.field)) {
      throw new InvalidChangeRequestDecisionError(decision.field, "This change request does not ask for that.");
    }
    if (byField.has(decision.field)) {
      throw new InvalidChangeRequestDecisionError(decision.field, "Decide each change once.");
    }
    byField.set(decision.field, decision);
  }

  const items = request.items.map((item): ChangeRequestItem => {
    const decision = byField.get(item.change.field);
    if (decision === undefined) {
      throw new InvalidChangeRequestDecisionError(item.change.field, "Accept or decline every change.");
    }
    if (decision.outcome === "Accepted") {
      return { change: item.change, decision: "Accepted", reason: null };
    }
    const reason = decision.reason.trim();
    if (reason.length === 0) {
      throw new InvalidChangeRequestDecisionError(item.change.field, "Say why you are declining this change.");
    }
    return { change: item.change, decision: "Declined", reason };
  });

  const accepted = items.filter((item) => item.decision === "Accepted").map((item) => item.change);
  const acceptedTimes = accepted.find((change) => change.field === "times");

  return {
    items,
    notEssential: accepted.flatMap((change): ArrangementType[] => {
      if (change.field === "equipment_requirements" && change.value === null) {
        return ["equipment"];
      }
      if (change.field === "registration" && change.value === null) {
        return ["registration"];
      }
      return [];
    }),
    revalidation: {
      bookingFlagFields: accepted.map((change) => change.field).filter((field) => FLAGS_BOOKINGS.includes(field)),
      equipmentReview: acceptedTimes !== undefined && !sameDates(currentTimes, acceptedTimes.value),
    },
    rescheduled: acceptedTimes !== undefined,
  };
}

function sameDates(a: readonly TimeRangeOnDate[], b: readonly TimeRangeOnDate[]): boolean {
  const left = new Set(a.map((range) => range.date));
  const right = new Set(b.map((range) => range.date));
  return left.size === right.size && [...left].every((date) => right.has(date));
}
