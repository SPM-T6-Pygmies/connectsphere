import type { Brand } from "./brand";
import type { CoordinatorEventStatus } from "./coordinator-event";
import {
  BookingNotCancellableError,
  BookingNotDecidableError,
  BookingRoomLayoutNotChangeableError,
  CancelledEventBookingError,
  DecisionReasonRequiredError,
  DuplicateBookingDateError,
  HoldNotLiveError,
  HoldSlotStartedError,
  IncompleteBookingTimeError,
  InvalidBookingDateError,
  InvalidBookingTimeError,
  NoBookingSlotsError,
  ReRequestNotHoldableError,
  RoomLayoutRequiredError,
  UnsupportedRoomLayoutError,
  VenueClosedError,
  VenueSlotUnavailableError,
} from "./errors";
import { joinSlots, rangeStartsAt, type TimeRangeOnDate } from "./event-times";
import { closedPeriods } from "./opening-hours";
import { paddedWindows, shiftDate, type Buffers } from "./padded-window";
import {
  END_OF_DAY,
  formatRange,
  fromMinutes,
  GRID_MINUTES,
  isOnGrid,
  overlaps,
  toMinutes,
  type TimeRange,
} from "./time-of-day";
import type { UserAccountId } from "./user-account";
import type { Venue, VenueId } from "./venue";
import { bufferMinutes } from "./venue-buffers";

/** `booking_status_chk`. */
export type BookingStatus =
  | "Requested"
  | "Tentative Hold"
  | "Confirmed"
  | "Rejected"
  | "Released"
  | "Cancelled"
  /** SPM-253: a Tentative Hold that ran out unconfirmed. Not Released, which a person does. */
  | "Expired";

export type BookingId = Brand<string, "BookingId">;

/**
 * The hours `slot` covers on its date, so a block's slot can be compared with a booking's time.
 * A slot is a 15-minute code, '0' (00:00-00:15) to '95' (23:45-24:00) (SPM-331).
 */
export function slotTime({ date, slot }: { readonly date: string; readonly slot: string }): TimeRangeOnDate {
  const n = Number(slot);
  if (!Number.isInteger(n) || String(n) !== slot || n < 0 || n >= END_OF_DAY / GRID_MINUTES) {
    throw new Error(`Unknown slot code "${slot}"`);
  }
  return { date, start: fromMinutes(n * GRID_MINUTES), end: fromMinutes((n + 1) * GRID_MINUTES) };
}

/** Time some existing booking at the venue already has (SPM-324). */
export interface OccupiedTime extends TimeRangeOnDate {
  /** The booking that has it; a read that does not say, such as the venue calendar's, leaves it out. */
  readonly bookingId?: string;
  readonly status: BookingStatus;
  /** When a Tentative Hold lapses; null when none is set, and for every other status. */
  readonly holdExpiresAt: Date | null;
}

/** A booking request as submitted, before Venue Staff have seen it. */
export interface BookingRequest {
  readonly eventId: string;
  readonly venueId: VenueId;
  /**
   * The name of a layout the venue supports -- layouts are matched by name, as
   * the catalogue keeps them (SPM-42). Null only when the venue has none.
   */
  readonly roomLayout: string | null;
  /** One start and end time per date, sorted by date (SPM-324). */
  readonly times: readonly TimeRangeOnDate[];
  readonly requestedBy: UserAccountId;
  readonly status: "Requested";
  /** SPM-251: the flagged booking this request asks to replace; null for an ordinary request. */
  readonly replacesBookingId: BookingId | null;
}

/**
 * How long a Tentative Hold lasts, from the moment Venue Staff place it. The
 * customer left the figure to the team ([#39]); this is the one place it is
 * set. SPM-253 expires a hold against it.
 */
export const DEFAULT_HOLD_HOURS = 72;

/**
 * Whether a booking keeps its slot from anyone else: only one tentative hold
 * or confirmed booking per venue and slot (#41), and a clash is blocked
 * outright, not warned about (#35). A pending, rejected or released booking
 * holds nothing.
 *
 * SPM-46 AC4: a Tentative Hold holds only until `holdExpiresAt`. A hold with
 * no expiry counts as live, so this errs towards keeping the slot; every hold
 * placed by SPM-218 carries one. The database restates the rule in
 * `booking_holds_slot`.
 *
 * Known gap (#123): the setup and turnaround buffer slots either side of a
 * booking are not counted yet -- only the booking's own slots are. The buffer
 * rules are still open on SPM-19.
 */
export function holdsSlot(
  slot: Pick<OccupiedTime, "status" | "holdExpiresAt">,
  now: Date,
): boolean {
  return (
    slot.status === "Confirmed" ||
    (slot.status === "Tentative Hold" &&
      (slot.holdExpiresAt === null || slot.holdExpiresAt > now))
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day, not just the right shape: 2026-02-30 is refused. */
export function isCalendarDate(raw: string): boolean {
  if (!ISO_DATE.test(raw)) {
    return false;
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw;
}

/**
 * SPM-104: the layout a booking assumes, as a reference to one the venue
 * supports -- never free text. A choice is required only when there is one
 * to make: a venue with a single layout takes that layout, and one with none
 * on record has nothing to choose from.
 */
export function chooseRoomLayout(venue: Venue, requested: string | null): string | null {
  if (requested !== null) {
    if (!venue.layouts.some((layout) => layout.name === requested)) {
      throw new UnsupportedRoomLayoutError(requested);
    }
    return requested;
  }

  if (venue.layouts.length > 1) {
    throw new RoomLayoutRequiredError();
  }
  return venue.layouts[0]?.name ?? null;
}

/**
 * SPM-104: whether the event's expected attendance fits the layout a booking
 * assumes. Compared with that layout's own capacity -- never the venue-wide
 * figure, which says nothing about how the room is set up (SPM-106).
 *
 * `withinCapacity` is null when there is nothing to compare: no attendance
 * figure on the event yet, no layout on the booking, or a layout the venue no
 * longer lists (SPM-105). An answer of "unknown" never blocks a page.
 */
export interface LayoutCapacityCheck {
  readonly layout: string | null;
  readonly capacity: number | null;
  readonly expectedAttendance: number | null;
  readonly withinCapacity: boolean | null;
}

export function checkLayoutCapacity(
  venue: Venue,
  layout: string | null,
  expectedAttendance: number | null,
): LayoutCapacityCheck {
  const capacity =
    venue.layouts.find((candidate) => candidate.name === layout)?.capacity ??
    null;

  return {
    layout,
    capacity,
    expectedAttendance,
    withinCapacity:
      capacity === null || expectedAttendance === null
        ? null
        : expectedAttendance <= capacity,
  };
}

/**
 * SPM-104: the layout a pending booking is moved to. Only a request still
 * waiting for Venue Staff can change; the new layout is held to the same rule
 * as a first choice (`chooseRoomLayout`).
 */
export function chooseLayoutChange(
  booking: { readonly status: BookingStatus },
  venue: Venue,
  requested: string | null,
): string | null {
  if (booking.status !== "Requested") {
    throw new BookingRoomLayoutNotChangeableError(booking.status);
  }
  return chooseRoomLayout(venue, requested);
}

/** One requested date as the coordinator entered it; a blank is `""`. */
export interface BookingTimeInput {
  readonly date: string;
  readonly start: string;
  readonly end: string;
}

/**
 * SPM-324 AC1: the times a booking request asks for, one start and end time
 * per date, on the 15-minute grid. The end is after the start, so no time
 * crosses midnight; 24:00 is a valid end but not a start. A missing date or
 * time is refused, naming which. Sorted by date.
 */
export function defineBookingTimes(rows: readonly BookingTimeInput[]): TimeRangeOnDate[] {
  if (rows.length === 0) {
    throw new NoBookingSlotsError();
  }

  const seen = new Set<string>();
  const times = rows.map((row) => {
    const date = row.date.trim();
    if (date === "") {
      throw new IncompleteBookingTimeError("date", null);
    }
    if (row.start.trim() === "") {
      throw new IncompleteBookingTimeError("start", date);
    }
    if (row.end.trim() === "") {
      throw new IncompleteBookingTimeError("end", date);
    }
    if (!isCalendarDate(date)) {
      throw new InvalidBookingDateError(date);
    }

    const from = toMinutes(row.start);
    if (from === null || from >= END_OF_DAY || !isOnGrid(from)) {
      throw new InvalidBookingTimeError(
        date,
        `Choose a start time for ${date} on the quarter hour, from 00:00 to 23:45.`,
      );
    }
    const to = toMinutes(row.end);
    if (to === null || !isOnGrid(to)) {
      throw new InvalidBookingTimeError(
        date,
        `Choose an end time for ${date} on the quarter hour, up to 24:00.`,
      );
    }
    // An end before the start is a time that crosses midnight, which no booking does.
    if (to <= from) {
      throw new InvalidBookingTimeError(date, `The end time for ${date} must be after the start time.`);
    }

    if (seen.has(date)) {
      throw new DuplicateBookingDateError(date);
    }
    seen.add(date);
    return { date, start: fromMinutes(from), end: fromMinutes(to) };
  });

  return times.sort((a, b) => a.date.localeCompare(b.date));
}

function minutesOf({ start, end }: TimeRangeOnDate): TimeRange {
  return { start: toMinutes(start) ?? 0, end: toMinutes(end) ?? 0 };
}

/**
 * SPM-324 AC2, AC3: the parts of the requested times that a live hold or
 * confirmed booking already has at `now`, joined into ranges. Overlap by any
 * amount clashes; a time that only touches another does not.
 */
export function clashingTimes(
  requested: readonly TimeRangeOnDate[],
  occupied: readonly OccupiedTime[],
  now: Date,
): TimeRangeOnDate[] {
  return sharedTimes(
    requested,
    occupied.filter((o) => holdsSlot(o, now)),
  );
}

/**
 * SPM-325 AC6 (SPM-475): `clashingTimes`, counting setup and turnaround. The requested times and
 * every live booking's are each widened by the one padded-window rule (SPM-463), with the venue's
 * own values, and the parts those windows share are named, joined. Windows that only touch do not
 * clash, and a window past midnight is compared on the neighbouring date, so `occupied` must cover
 * `clashDates`. With no setup or turnaround this is `clashingTimes`. Venue Staff's approval applies
 * the same rule in `booking_padded_clashes` (SPM-470).
 */
export function paddedClashingTimes(
  requested: readonly TimeRangeOnDate[],
  occupied: readonly OccupiedTime[],
  buffers: Buffers,
  now: Date,
): TimeRangeOnDate[] {
  const pad = (times: readonly TimeRangeOnDate[]) => times.flatMap((time) => paddedWindows(time, buffers));
  return sharedTimes(pad(requested), pad(occupied.filter((o) => holdsSlot(o, now))));
}

/**
 * SPM-475: the dates whose bookings a request on `dates` is compared with -- each one and the day
 * either side, since a padded window can run past midnight. A date that is not a calendar day is
 * kept as it is, for `defineBookingTimes` to refuse by name.
 */
export function clashDates(dates: readonly string[]): string[] {
  return [
    ...new Set(
      dates.flatMap((date) =>
        isCalendarDate(date) ? [shiftDate(date, -1), date, shiftDate(date, 1)] : [date],
      ),
    ),
  ];
}

/**
 * SPM-21 AC12, SPM-324: the parts of `times` that blocks over these slots
 * cover, joined into ranges. Blocks are compared by their hours (SPM-321).
 */
export function blockedTimes(
  times: readonly TimeRangeOnDate[],
  blocks: readonly { readonly date: string; readonly slot: string }[],
): TimeRangeOnDate[] {
  return sharedTimes(times, blocks.map(slotTime));
}

/** The parts of `wanted` that any of `taken` also covers, joined. */
function sharedTimes(
  wanted: readonly TimeRangeOnDate[],
  taken: readonly TimeRangeOnDate[],
): TimeRangeOnDate[] {
  return joinSlots(
    wanted.flatMap((time) => {
      const want = minutesOf(time);
      return taken
        .filter((other) => other.date === time.date && overlaps(want, minutesOf(other)))
        .map((other) => {
          const have = minutesOf(other);
          return {
            date: time.date,
            start: fromMinutes(Math.max(want.start, have.start)),
            end: fromMinutes(Math.min(want.end, have.end)),
          };
        });
    }),
  );
}

/**
 * SPM-46, SPM-324: an Event Coordinator asks Venue Staff for one venue, at a
 * start and end time on each of one or more dates, for one event. The times
 * follow `defineBookingTimes`.
 *
 * A time the venue is closed for, even in part, refuses the request, naming
 * the closed time (SPM-334).
 *
 * `occupied` is what the venue already carries on the requested days. Overlap
 * with a live hold or confirmed booking by any amount refuses the request
 * outright, naming the overlap (#35, #41, SPM-324 AC2); clashing with another
 * pending request, or a hold that expired before `now`, does not. Both sides
 * count with the venue's setup and turnaround time (SPM-325 AC6), so `occupied`
 * covers `clashDates`.
 *
 * SPM-55 AC6: a Cancelled event takes no new requests, whatever else it asks
 * for. `coordinator_submit_booking_request` restates this under a lock on the
 * event, so a request racing the cancellation is refused too.
 *
 * SPM-251 AC5: a re-request never clashes with the booking it replaces, so
 * asking for the same venue at an overlapping time is not refused for it.
 * Every other booking still clashes.
 */
export function requestVenueBooking(input: {
  readonly eventId: string;
  readonly eventStatus: CoordinatorEventStatus;
  readonly venue: Venue;
  readonly roomLayout: string | null;
  readonly times: readonly BookingTimeInput[];
  readonly requestedBy: UserAccountId;
  readonly occupied: readonly OccupiedTime[];
  readonly now: Date;
  /** SPM-251: the flagged booking being replaced; absent for an ordinary request. */
  readonly replacing?: BookingId | null;
}): BookingRequest {
  const replacing = input.replacing ?? null;
  if (input.eventStatus === "Cancelled") {
    throw new CancelledEventBookingError();
  }

  const times = defineBookingTimes(input.times);

  const roomLayout = chooseRoomLayout(input.venue, input.roomLayout);

  const closed = times.flatMap((time) =>
    closedPeriods(input.venue.openingHours, minutesOf(time)).map((range) => ({
      date: time.date,
      time: formatRange(range),
    })),
  );
  if (closed.length > 0) {
    throw new VenueClosedError(closed);
  }

  const buffers = bufferMinutes(input.venue);
  const clashes = paddedClashingTimes(
    times,
    input.occupied.filter((time) => replacing === null || time.bookingId !== replacing),
    buffers,
    input.now,
  );
  if (clashes.length > 0) {
    throw new VenueSlotUnavailableError(clashes, buffers.setup > 0 || buffers.turnaround > 0);
  }

  return {
    eventId: input.eventId,
    venueId: input.venue.id,
    roomLayout,
    times,
    requestedBy: input.requestedBy,
    status: "Requested",
    replacesBookingId: replacing,
  };
}

/**
 * SPM-253: when a hold placed `now` on `times` lapses -- `DEFAULT_HOLD_HOURS`
 * later, or when the earliest of its times starts if that comes first, since a
 * hold that outlives its time means nothing. A time that has started, or starts
 * this instant, refuses the whole hold.
 */
function holdExpiry(times: readonly TimeRangeOnDate[], now: Date): Date {
  const earliestStart = Math.min(...times.map((time) => rangeStartsAt(time).getTime()));
  if (earliestStart <= now.getTime()) {
    throw new HoldSlotStartedError();
  }

  return new Date(Math.min(now.getTime() + DEFAULT_HOLD_HOURS * 60 * 60 * 1000, earliestStart));
}

/** A booking as Venue Staff decide it: what the decision rules need, nothing more. */
export interface BookingForDecision {
  readonly id: BookingId;
  readonly venueId: VenueId;
  readonly status: BookingStatus;
  /** In date then start order. */
  readonly times: readonly TimeRangeOnDate[];
  /** SPM-251: the flagged booking a re-request replaces; absent or null for an ordinary request. */
  readonly replaces?: { readonly id: BookingId } | null;
}

export type BookingDecision =
  | { readonly kind: "approve" }
  /** SPM-218: Venue Staff hold the request's slots while the coordinator finalises the event. */
  | { readonly kind: "hold" }
  | {
      readonly kind: "reject";
      readonly reason: string;
      /** An informal suggestion, not a counter-offer (#45); it books nothing. */
      readonly suggestedAlternative: VenueId | null;
    };

/** The outcome of a decision, ready for the store to record. */
export interface DecidedBooking {
  readonly id: BookingId;
  readonly status: "Confirmed" | "Rejected" | "Tentative Hold";
  readonly decidedBy: UserAccountId;
  /** Null unless rejected. */
  readonly rejectionNote: string | null;
  readonly suggestedAlternative: VenueId | null;
  /** Only on a hold: when it lapses, `DEFAULT_HOLD_HOURS` after it was placed. */
  readonly holdExpiresAt?: Date;
}

/**
 * SPM-22: Venue Staff approve or reject a booking request. SPM-218: or hold it.
 *
 * Approving confirms the booking, which holds its slots from then on, so it
 * meets the same hard block a request does (#35, #41): a slot another booking
 * already holds refuses the approval, however many requests asked for it.
 * Placing a hold keeps the same slots from the same moment, so it meets the
 * same block; it lapses `DEFAULT_HOLD_HOURS` later.
 * Whether another booking is in the way, setup and turnaround included, is the
 * store's call at the moment of the decision (SPM-19), not this function's.
 * Rejecting must say why -- the reason is what the coordinator acts on -- and holds
 * nothing, so it needs no clash check.
 *
 * SPM-251 AC10: a re-request is approved or rejected, never held. A hold would
 * sit beside the booking it replaces, and on the same venue and time the
 * one-booking-per-slot rule cannot allow both. Approving it replaces that
 * booking, which the store does in the same transaction (AC6).
 */
export function decideBooking(
  booking: BookingForDecision,
  decision: BookingDecision,
  decidedBy: UserAccountId,
  now: Date,
): DecidedBooking {
  if (booking.status !== "Requested") {
    throw new BookingNotDecidableError();
  }

  if (decision.kind === "approve" || decision.kind === "hold") {
    if (decision.kind === "hold") {
      if ((booking.replaces ?? null) !== null) {
        throw new ReRequestNotHoldableError();
      }
      return {
        id: booking.id,
        status: "Tentative Hold",
        decidedBy,
        rejectionNote: null,
        suggestedAlternative: null,
        holdExpiresAt: holdExpiry(booking.times, now),
      };
    }
    return {
      id: booking.id,
      status: "Confirmed",
      decidedBy,
      rejectionNote: null,
      suggestedAlternative: null,
    };
  }

  const reason = decision.reason.trim();
  if (reason.length === 0) {
    throw new DecisionReasonRequiredError();
  }
  return {
    id: booking.id,
    status: "Rejected",
    decidedBy,
    rejectionNote: reason,
    suggestedAlternative: decision.suggestedAlternative,
  };
}

/** A booking as Venue Staff resolve its hold: its status and when the hold lapses. */
export interface BookingForHoldResolution {
  readonly id: BookingId;
  readonly status: BookingStatus;
  readonly holdExpiresAt: Date | null;
}

/** SPM-219: how Venue Staff end a live hold. */
export type HoldResolution = "confirm" | "release";

/** The outcome of resolving a hold, ready for the store to record. */
export interface ResolvedHold {
  readonly id: BookingId;
  readonly status: "Confirmed" | "Released";
  readonly resolvedBy: UserAccountId;
}

/**
 * SPM-219: Venue Staff confirm or release a live hold.
 *
 * Confirming commits the held slots to the event and releasing frees them at
 * once, for another hold or booking. Either needs the hold to be live now:
 * still a Tentative Hold, and not past its expiry, by the same test
 * `holdsSlot` uses to keep the slot. An expired hold is refused even if its
 * status has not been moved on yet (a read marks it Expired, SPM-253), and so is a booking
 * that was never held. Confirming needs no clash check: the hold already owns
 * the slots, and the one-per-slot rule would refuse any second claim on them.
 */
export function resolveHold(
  booking: BookingForHoldResolution,
  resolution: HoldResolution,
  resolvedBy: UserAccountId,
  now: Date,
): ResolvedHold {
  if (booking.status !== "Tentative Hold" || !holdsSlot(booking, now)) {
    throw new HoldNotLiveError();
  }

  return {
    id: booking.id,
    status: resolution === "confirm" ? "Confirmed" : "Released",
    resolvedBy,
  };
}

/**
 * SPM-20: whether the assigned coordinator can still cancel a booking -- one
 * that holds its slots, or may yet: a pending request, a hold or a confirmed
 * booking. A rejected, released, cancelled or expired one holds nothing, so
 * there is nothing left to free.
 */
export function bookingCancellable(status: BookingStatus): boolean {
  return status === "Requested" || status === "Tentative Hold" || status === "Confirmed";
}

/**
 * SPM-63: whether Venue Staff are told a cancelled booking was released --
 * only a Confirmed one, since that is the venue they may be preparing. A
 * pending request or a hold was never confirmed to them as going ahead.
 */
export function cancellationNotifiesVenueStaff(status: BookingStatus): boolean {
  return status === "Confirmed";
}

/**
 * SPM-20: the assigned Event Coordinator cancels a booking, at any stage of
 * the event (AC1). It becomes Released, which frees its slots at once, since
 * `holdsSlot` counts only a live hold or a confirmed booking (AC2). Whether the
 * coordinator is the event's is the use case's check, not this rule's.
 */
export function cancelBooking(booking: { readonly status: BookingStatus }): "Released" {
  if (!bookingCancellable(booking.status)) {
    throw new BookingNotCancellableError(booking.status);
  }
  return "Released";
}
