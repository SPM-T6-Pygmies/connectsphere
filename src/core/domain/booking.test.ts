import { describe, expect, it } from "vitest";

import {
  blockedTimes,
  bookingCancellable,
  cancelBooking,
  cancellationNotifiesVenueStaff,
  checkLayoutCapacity,
  chooseLayoutChange,
  chooseRoomLayout,
  clashDates,
  clashingTimes,
  decideBooking,
  defineBookingTimes,
  DEFAULT_HOLD_HOURS,
  holdsSlot,
  paddedClashingTimes,
  requestVenueBooking,
  resolveHold,
  type BookingForDecision,
  type BookingForHoldResolution,
  type BookingId,
  type BookingStatus,
  type OccupiedTime,
} from "./booking";
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
  RoomLayoutRequiredError,
  UnsupportedRoomLayoutError,
  VenueClosedError,
  VenueSlotUnavailableError,
} from "./errors";
import type { CoordinatorEventStatus } from "./coordinator-event";
import type { TimeRangeOnDate } from "./event-times";
import type { OpeningWindow } from "./opening-hours";
import { slotCodesFor } from "./slot-grid";
import { toMinutes } from "./time-of-day";
import { userAccountId } from "./user-account";
import { venueId, type Venue } from "./venue";

const THEATRE = "Theatre";
const CLASSROOM = "Classroom";
const BANQUET = "Banquet";

function venue(layouts: readonly string[] = [THEATRE, CLASSROOM]): Venue {
  return {
    id: venueId("venue-1"),
    location: "Harbour Hall",
    facilities: null,
    accessibility: null,
    openingHours: [{ start: "00:00", end: "24:00" }],
    capacity: null,
    bookingHorizonDays: null,
    layouts: layouts.map((name) => ({ name, capacity: 100 })),
  };
}

/** The clock every rule here reads; a hold expires either side of it. */
const NOW = new Date("2026-10-01T09:00:00+08:00");
const BEFORE_NOW = new Date("2026-10-01T08:59:59+08:00");
const AFTER_NOW = new Date("2026-10-01T09:00:01+08:00");

/** Three times of day the cases ask for: a morning, an afternoon and an evening that ends at 24:00. */
const MORNING = { start: "07:00", end: "12:00" };
const AFTERNOON = { start: "13:00", end: "18:00" };
const EVENING = { start: "19:00", end: "24:00" };

function occupied(
  date: string,
  time: { start: string; end: string },
  status: BookingStatus,
  holdExpiresAt: Date | null = null,
): OccupiedTime {
  return { date, ...time, status, holdExpiresAt };
}

function request(
  times: readonly TimeRangeOnDate[],
  existing: readonly OccupiedTime[] = [],
  layout: string | null = THEATRE,
  eventStatus: CoordinatorEventStatus = "Planning",
) {
  return requestVenueBooking({
    eventId: "event-1",
    eventStatus,
    venue: venue(),
    roomLayout: layout,
    times,
    requestedBy: userAccountId("coordinator-1"),
    occupied: existing,
    now: NOW,
  });
}

describe("requestVenueBooking (SPM-46)", () => {
  it("records one venue, one time and the event as a Requested booking (AC1)", () => {
    expect(request([{ date: "2026-10-05", ...MORNING }])).toEqual({
      eventId: "event-1",
      venueId: "venue-1",
      roomLayout: THEATRE,
      times: [{ date: "2026-10-05", start: "07:00", end: "12:00" }],
      requestedBy: "coordinator-1",
      status: "Requested",
    });
  });

  it("takes a time on each of several days, in date order (AC1)", () => {
    const booking = request([
      { date: "2026-10-06", ...MORNING },
      { date: "2026-10-05", ...EVENING },
    ]);

    expect(booking.times).toEqual([
      { date: "2026-10-05", start: "19:00", end: "24:00" },
      { date: "2026-10-06", start: "07:00", end: "12:00" },
    ]);
  });

  it("refuses a request with no slots", () => {
    expect(() => request([])).toThrow(NoBookingSlotsError);
  });

  it("refuses the same day twice", () => {
    expect(() =>
      request([
        { date: "2026-10-05", ...AFTERNOON },
        { date: "2026-10-05", ...AFTERNOON },
      ]),
    ).toThrow(DuplicateBookingDateError);
  });

  it.each(["2026-02-30", "2026-13-01", "05/10/2026"])(
    "refuses %j, which is not a calendar date",
    (date) => {
      expect(() => request([{ date, ...MORNING }])).toThrow(InvalidBookingDateError);
    },
  );

  it("blocks outright a slot that already carries a Confirmed booking at the venue (AC4)", () => {
    expect(() =>
      request([{ date: "2026-10-05", ...AFTERNOON }], [occupied("2026-10-05", AFTERNOON, "Confirmed")]),
    ).toThrow(VenueSlotUnavailableError);
  });

  it("names only the clashing times when some of a request's dates are free (AC4)", () => {
    let caught: unknown;
    try {
      request(
        [
          { date: "2026-10-04", ...MORNING },
          { date: "2026-10-05", ...AFTERNOON },
          { date: "2026-10-06", ...MORNING },
        ],
        [occupied("2026-10-05", AFTERNOON, "Confirmed"), occupied("2026-10-06", MORNING, "Confirmed")],
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VenueSlotUnavailableError);
    expect((caught as VenueSlotUnavailableError).times).toEqual([
      { date: "2026-10-05", start: "13:00", end: "18:00" },
      { date: "2026-10-06", start: "07:00", end: "12:00" },
    ]);
  });

  it("blocks a slot on tentative hold too -- one hold or booking per slot (#41)", () => {
    expect(() =>
      request(
        [{ date: "2026-10-05", ...MORNING }],
        [occupied("2026-10-05", MORNING, "Tentative Hold", AFTER_NOW)],
      ),
    ).toThrow(VenueSlotUnavailableError);
  });

  it("does not block on a hold that expired before now (AC4)", () => {
    expect(
      request(
        [{ date: "2026-10-05", ...MORNING }],
        [occupied("2026-10-05", MORNING, "Tentative Hold", BEFORE_NOW)],
      ).status,
    ).toBe("Requested");
  });

  it("does not block on a hold expiring exactly now -- it holds only while expiry is later (AC4)", () => {
    expect(
      request(
        [{ date: "2026-10-05", ...MORNING }],
        [occupied("2026-10-05", MORNING, "Tentative Hold", NOW)],
      ).status,
    ).toBe("Requested");
  });

  it("blocks on a hold with no expiry, which counts as live (AC4)", () => {
    expect(() =>
      request([{ date: "2026-10-05", ...MORNING }], [occupied("2026-10-05", MORNING, "Tentative Hold", null)]),
    ).toThrow(VenueSlotUnavailableError);
  });

  it.each<BookingStatus>(["Requested", "Rejected", "Released", "Cancelled"])(
    "does not block on a %s booking of the same slot -- it holds nothing",
    (status) => {
      expect(
        request([{ date: "2026-10-05", ...MORNING }], [occupied("2026-10-05", MORNING, status)]).status,
      ).toBe("Requested");
    },
  );

  it("allows the adjacent slot to a Confirmed booking at a venue with no setup or turnaround", () => {
    expect(
      request([{ date: "2026-10-05", ...AFTERNOON }], [occupied("2026-10-05", MORNING, "Confirmed")])
        .times,
    ).toEqual([{ date: "2026-10-05", start: "13:00", end: "18:00" }]);
  });

  it("allows the same slot on a different day", () => {
    expect(
      request([{ date: "2026-10-06", ...MORNING }], [occupied("2026-10-05", MORNING, "Confirmed")])
        .status,
    ).toBe("Requested");
  });

  it("needs a layout when the venue supports more than one (AC2)", () => {
    expect(() => request([{ date: "2026-10-05", ...MORNING }], [], null)).toThrow(
      RoomLayoutRequiredError,
    );
  });
});

describe("requestVenueBooking over closed time (SPM-334)", () => {
  /** A venue converted from AM and Night (SPM-320 AC4). */
  const AM_AND_NIGHT = [
    { start: "07:00", end: "12:00" },
    { start: "19:00", end: "24:00" },
  ];

  function requestAt(openingHours: readonly OpeningWindow[], times: readonly TimeRangeOnDate[]) {
    return requestVenueBooking({
      eventId: "event-1",
      eventStatus: "Planning",
      venue: { ...venue(), openingHours },
      roomLayout: THEATRE,
      times,
      requestedBy: userAccountId("coordinator-1"),
      occupied: [],
      now: NOW,
    });
  }

  it("accepts times that fall exactly within the opening windows, ending at 24:00", () => {
    const booking = requestAt(AM_AND_NIGHT, [
      { date: "2026-10-05", ...MORNING },
      { date: "2026-10-06", ...EVENING },
    ]);

    expect(booking.status).toBe("Requested");
  });

  it("refuses a slot in the closed gap between windows, naming the closed time", () => {
    expect(() => requestAt(AM_AND_NIGHT, [{ date: "2026-10-05", ...AFTERNOON }])).toThrow(
      "The venue is closed 2026-10-05 13:00–18:00.",
    );
  });

  it("refuses a slot the venue is closed for only part of, naming just that part", () => {
    expect(() =>
      requestAt([{ start: "08:00", end: "11:45" }], [{ date: "2026-10-05", ...MORNING }]),
    ).toThrow("The venue is closed 2026-10-05 07:00–08:00, 2026-10-05 11:45–12:00.");
  });

  it("refuses the whole request when any one slot includes closed time", () => {
    expect(() =>
      requestAt(AM_AND_NIGHT, [
        { date: "2026-10-05", ...MORNING },
        { date: "2026-10-06", ...AFTERNOON },
      ]),
    ).toThrow(VenueClosedError);
  });

  it("refuses a venue with no opening hours", () => {
    expect(() => requestAt([], [{ date: "2026-10-05", ...MORNING }])).toThrow(
      "The venue is closed 2026-10-05 07:00–12:00.",
    );
  });
});

describe("requestVenueBooking on a cancelled event (SPM-55)", () => {
  it("refuses a Cancelled event (AC6)", () => {
    expect(() => request([{ date: "2026-10-05", ...MORNING }], [], THEATRE, "Cancelled")).toThrow(
      CancelledEventBookingError,
    );
  });

  it.each<CoordinatorEventStatus>(["Planning", "Blocked", "Confirmed", "Completed"])(
    "still takes a request for a %s event (AC6)",
    (status) => {
      expect(request([{ date: "2026-10-05", ...MORNING }], [], THEATRE, status).status).toBe(
        "Requested",
      );
    },
  );
});

describe("chooseRoomLayout (SPM-104)", () => {
  it("records the chosen layout as a reference to one the venue supports (AC1)", () => {
    expect(chooseRoomLayout(venue([THEATRE, CLASSROOM]), CLASSROOM)).toBe(CLASSROOM);
  });

  it("refuses a layout the venue does not support", () => {
    expect(() => chooseRoomLayout(venue([THEATRE, CLASSROOM]), BANQUET)).toThrow(
      UnsupportedRoomLayoutError,
    );
  });

  it("requires a choice when the venue supports more than one layout (AC2)", () => {
    expect(() => chooseRoomLayout(venue([THEATRE, CLASSROOM]), null)).toThrow(
      RoomLayoutRequiredError,
    );
  });

  it("takes a single-layout venue's only layout when none is given", () => {
    expect(chooseRoomLayout(venue([THEATRE]), null)).toBe(THEATRE);
  });

  it("refuses another layout for a single-layout venue", () => {
    expect(() => chooseRoomLayout(venue([THEATRE]), CLASSROOM)).toThrow(UnsupportedRoomLayoutError);
  });

  it("records no layout when the venue has none on record", () => {
    expect(chooseRoomLayout(venue([]), null)).toBeNull();
  });
});

describe("decideBooking (SPM-22)", () => {
  const staff = userAccountId("staff-1");
  const waiting: BookingForDecision = {
    id: "booking-1" as BookingId,
    venueId: venueId("v1"),
    status: "Requested",
    times: [
      { date: "2026-10-22", start: "07:00", end: "12:00" },
      { date: "2026-10-22", start: "13:00", end: "18:00" },
    ],
  };

  it("approving confirms the booking and records who decided", () => {
    expect(decideBooking(waiting, { kind: "approve" }, staff, NOW)).toEqual({
      id: waiting.id,
      status: "Confirmed",
      decidedBy: staff,
      rejectionNote: null,
      suggestedAlternative: null,
    });
  });

  it("rejecting keeps the trimmed reason and the suggested alternative", () => {
    expect(
      decideBooking(
        waiting,
        { kind: "reject", reason: "  Closed for maintenance  ", suggestedAlternative: venueId("v2") },
        staff, NOW,
      ),
    ).toEqual({
      id: waiting.id,
      status: "Rejected",
      decidedBy: staff,
      rejectionNote: "Closed for maintenance",
      suggestedAlternative: venueId("v2"),
    });
  });

  it("rejecting without a reason is refused", () => {
    for (const reason of ["", "   "]) {
      expect(() =>
        decideBooking(waiting, { kind: "reject", reason, suggestedAlternative: null }, staff, NOW),
      ).toThrow(DecisionReasonRequiredError);
    }
  });

  it("refuses a booking that is no longer waiting, whichever way it is decided", () => {
    for (const status of ["Tentative Hold", "Confirmed", "Rejected", "Released", "Cancelled"] as const) {
      const decided = { ...waiting, status };
      expect(() => decideBooking(decided, { kind: "approve" }, staff, NOW)).toThrow(
        BookingNotDecidableError,
      );
      expect(() =>
        decideBooking(decided, { kind: "reject", reason: "No", suggestedAlternative: null }, staff, NOW),
      ).toThrow(BookingNotDecidableError);
    }
  });
});

describe("decideBooking placing a hold (SPM-218)", () => {
  const staff = userAccountId("staff-1");
  const waiting: BookingForDecision = {
    id: "booking-1" as BookingId,
    venueId: venueId("v1"),
    status: "Requested",
    times: [
      { date: "2026-10-22", start: "07:00", end: "12:00" },
      { date: "2026-10-22", start: "13:00", end: "18:00" },
    ],
  };
  const hold = { kind: "hold" } as const;

  it("a hold lasts 72 hours, set in one place", () => {
    expect(DEFAULT_HOLD_HOURS).toBe(72);
  });

  it("holding a request puts it on hold, records who, and expires it 72 hours after now (AC1)", () => {
    const decided = decideBooking(waiting, hold, staff, NOW);

    expect(decided).toEqual({
      id: waiting.id,
      status: "Tentative Hold",
      decidedBy: staff,
      rejectionNote: null,
      suggestedAlternative: null,
      holdExpiresAt: new Date("2026-10-04T09:00:00+08:00"),
    });
    expect(decided.holdExpiresAt!.getTime() - NOW.getTime()).toBe(DEFAULT_HOLD_HOURS * 60 * 60 * 1000);
  });

  it("only a request still waiting can be held, whatever its status is (AC1)", () => {
    for (const status of ["Tentative Hold", "Confirmed", "Rejected", "Released", "Cancelled"] as const) {
      expect(() => decideBooking({ ...waiting, status }, hold, staff, NOW)).toThrow(
        BookingNotDecidableError,
      );
    }
  });

  it("needs no reason, and approving or rejecting still carry no expiry", () => {
    expect(decideBooking(waiting, { kind: "approve" }, staff, NOW).holdExpiresAt).toBeUndefined();
    expect(
      decideBooking(waiting, { kind: "reject", reason: "No", suggestedAlternative: null }, staff, NOW)
        .holdExpiresAt,
    ).toBeUndefined();
  });
});

/** Layout figures deliberately unlike each other and the venue-wide figure (SPM-106 is open). */
function sizedVenue(
  layouts: readonly { name: string; capacity: number }[],
): Venue {
  return { ...venue(), capacity: 999, layouts };
}

describe("checkLayoutCapacity (SPM-104)", () => {
  const hall = sizedVenue([
    { name: "Theatre", capacity: 200 },
    { name: "Boardroom", capacity: 20 },
  ]);

  it("compares attendance with the chosen layout's capacity, not the venue-wide figure", () => {
    expect(checkLayoutCapacity(hall, "Boardroom", 100)).toEqual({
      layout: "Boardroom",
      capacity: 20,
      expectedAttendance: 100,
      withinCapacity: false,
    });
  });

  it("reads the other layout's figure when the other layout is chosen", () => {
    const result = checkLayoutCapacity(hall, "Theatre", 100);

    expect(result.capacity).toBe(200);
    expect(result.withinCapacity).toBe(true);
  });

  it("is within capacity one below and exactly at the layout's figure", () => {
    expect(checkLayoutCapacity(hall, "Boardroom", 19).withinCapacity).toBe(
      true,
    );
    expect(checkLayoutCapacity(hall, "Boardroom", 20).withinCapacity).toBe(
      true,
    );
  });

  it("is not within capacity one above the layout's figure", () => {
    expect(checkLayoutCapacity(hall, "Boardroom", 21).withinCapacity).toBe(
      false,
    );
  });

  it("gives no verdict when the event has no expected attendance yet", () => {
    expect(checkLayoutCapacity(hall, "Theatre", null)).toEqual({
      layout: "Theatre",
      capacity: 200,
      expectedAttendance: null,
      withinCapacity: null,
    });
  });

  it("gives no verdict when the booking has no layout, rather than using the venue-wide figure", () => {
    expect(checkLayoutCapacity(hall, null, 50)).toEqual({
      layout: null,
      capacity: null,
      expectedAttendance: 50,
      withinCapacity: null,
    });
  });

  it("gives no verdict when the venue no longer lists the layout, instead of failing the page", () => {
    const result = checkLayoutCapacity(hall, "Banquet", 50);

    expect(result.capacity).toBeNull();
    expect(result.withinCapacity).toBeNull();
  });
});

describe("chooseLayoutChange (SPM-104)", () => {
  const hall = sizedVenue([
    { name: "Theatre", capacity: 200 },
    { name: "Boardroom", capacity: 20 },
  ]);

  it("accepts a layout the venue supports while the request is still pending", () => {
    expect(chooseLayoutChange({ status: "Requested" }, hall, "Boardroom")).toBe(
      "Boardroom",
    );
  });

  it("refuses a layout the venue does not support", () => {
    expect(() =>
      chooseLayoutChange({ status: "Requested" }, hall, "Banquet"),
    ).toThrow(UnsupportedRoomLayoutError);
  });

  it("refuses no layout when the venue offers a choice", () => {
    expect(() =>
      chooseLayoutChange({ status: "Requested" }, hall, null),
    ).toThrow(RoomLayoutRequiredError);
  });

  it.each<BookingStatus>([
    "Tentative Hold",
    "Confirmed",
    "Rejected",
    "Released",
    "Cancelled",
  ])(
    "refuses a change once the booking is %s -- Venue Staff already answered it",
    (status) => {
      expect(() => chooseLayoutChange({ status }, hall, "Boardroom")).toThrow(
        BookingRoomLayoutNotChangeableError,
      );
    },
  );
});

describe("resolveHold confirming or releasing a hold (SPM-219)", () => {
  const staff = userAccountId("staff-2");
  const live: BookingForHoldResolution = {
    id: "booking-1" as BookingId,
    status: "Tentative Hold",
    holdExpiresAt: AFTER_NOW,
  };

  it("confirming a live hold makes it Confirmed and records who (AC1, AC3)", () => {
    expect(resolveHold(live, "confirm", staff, NOW)).toEqual({
      id: live.id,
      status: "Confirmed",
      resolvedBy: staff,
    });
  });

  it("releasing a live hold makes it Released and records who (AC2, AC3)", () => {
    expect(resolveHold(live, "release", staff, NOW)).toEqual({
      id: live.id,
      status: "Released",
      resolvedBy: staff,
    });
  });

  it("a hold with no expiry counts as live, as it does for blocking its slots (AC4)", () => {
    expect(resolveHold({ ...live, holdExpiresAt: null }, "confirm", staff, NOW).status).toBe("Confirmed");
  });

  it("is live up to the instant it expires, and not at it or after (AC4 boundary)", () => {
    const justBefore = { ...live, holdExpiresAt: new Date(NOW.getTime() + 1) };
    const exactly = { ...live, holdExpiresAt: NOW };
    const justAfter = { ...live, holdExpiresAt: new Date(NOW.getTime() - 1) };

    expect(resolveHold(justBefore, "release", staff, NOW).status).toBe("Released");
    expect(() => resolveHold(exactly, "confirm", staff, NOW)).toThrow(HoldNotLiveError);
    expect(() => resolveHold(justAfter, "release", staff, NOW)).toThrow(HoldNotLiveError);
  });

  it("only a hold can be confirmed or released, whatever else the booking is (AC4)", () => {
    for (const status of ["Requested", "Confirmed", "Rejected", "Released", "Cancelled", "Expired"] as const) {
      for (const resolution of ["confirm", "release"] as const) {
        expect(() => resolveHold({ ...live, status }, resolution, staff, NOW)).toThrow(HoldNotLiveError);
      }
    }
  });
});

describe("decideBooking capping a hold at its slot (SPM-253)", () => {
  const staff = userAccountId("staff-1");
  const hold = { kind: "hold" } as const;
  const waitingOn = (...times: TimeRangeOnDate[]): BookingForDecision => ({
    id: "booking-1" as BookingId,
    venueId: venueId("v1"),
    status: "Requested",
    times,
  });
  // NOW is 2026-10-01 09:00 in Singapore. MORNING starts at 07:00, AFTERNOON at 13:00.
  const SEVENTY_TWO_HOURS = DEFAULT_HOLD_HOURS * 60 * 60 * 1000;

  it("expires at the slot's start when that is sooner than 72 hours (AC7)", () => {
    const decided = decideBooking(waitingOn({ date: "2026-10-02", ...MORNING }), hold, staff, NOW);

    expect(decided.holdExpiresAt).toEqual(new Date("2026-10-02T07:00:00+08:00"));
  });

  it("keeps the 72-hour default when the slot starts later than that (AC7)", () => {
    const decided = decideBooking(waitingOn({ date: "2026-10-22", ...MORNING }), hold, staff, NOW);

    expect(decided.holdExpiresAt!.getTime() - NOW.getTime()).toBe(SEVENTY_TWO_HOURS);
  });

  it("is capped at the slot's start when the slot starts exactly 72 hours out (AC7 boundary)", () => {
    // 2026-10-04 09:00 is exactly 72 hours after NOW; no time starts then, so use one starting before it and one after.
    const justBefore = decideBooking(waitingOn({ date: "2026-10-04", ...MORNING }), hold, staff, NOW);
    const justAfter = decideBooking(waitingOn({ date: "2026-10-04", ...AFTERNOON }), hold, staff, NOW);

    expect(justBefore.holdExpiresAt).toEqual(new Date("2026-10-04T07:00:00+08:00"));
    expect(justAfter.holdExpiresAt).toEqual(new Date("2026-10-04T09:00:00+08:00"));
  });

  it("takes the earliest slot when the booking holds several (AC7)", () => {
    const decided = decideBooking(
      waitingOn({ date: "2026-10-03", ...AFTERNOON }, { date: "2026-10-02", ...AFTERNOON }),
      hold,
      staff, NOW,
    );

    expect(decided.holdExpiresAt).toEqual(new Date("2026-10-02T13:00:00+08:00"));
  });

  it("refuses a hold on a slot that has started, or starts this instant (AC7)", () => {
    expect(() => decideBooking(waitingOn({ date: "2026-10-01", ...MORNING }), hold, staff, NOW)).toThrow(
      HoldSlotStartedError,
    );
    const startsNow = new Date("2026-10-01T13:00:00+08:00");
    expect(() => decideBooking(waitingOn({ date: "2026-10-01", ...AFTERNOON }), hold, staff, startsNow)).toThrow(
      HoldSlotStartedError,
    );
  });

  it("refuses the whole hold when any one of its slots has started (AC7)", () => {
    expect(() =>
      decideBooking(
        waitingOn({ date: "2026-10-01", ...MORNING }, { date: "2026-10-05", ...MORNING }),
        hold,
        staff, NOW,
      ),
    ).toThrow(HoldSlotStartedError);
  });

  it("does not cap or refuse an approval: only a hold lapses (AC7)", () => {
    const decided = decideBooking(waitingOn({ date: "2026-10-02", ...MORNING }), { kind: "approve" }, staff, NOW);

    expect(decided.status).toBe("Confirmed");
    expect(decided.holdExpiresAt).toBeUndefined();
  });
});

describe("holdsSlot with an Expired booking (SPM-253)", () => {
  it("an Expired booking holds nothing, whatever its stored expiry says (AC2, AC4)", () => {
    expect(holdsSlot({ status: "Expired", holdExpiresAt: AFTER_NOW }, NOW)).toBe(false);
    expect(holdsSlot({ status: "Expired", holdExpiresAt: null }, NOW)).toBe(false);
  });
});

describe("cancelBooking (SPM-20)", () => {
  it("a Confirmed booking becomes Released, and its slots stop being held (AC2)", () => {
    const status = cancelBooking({ status: "Confirmed" });

    expect(status).toBe("Released");
    expect(holdsSlot({ status, holdExpiresAt: null }, NOW)).toBe(false);
  });

  it("can cancel at any stage: a pending request or a hold is Released too (AC1)", () => {
    expect(bookingCancellable("Requested")).toBe(true);
    expect(cancelBooking({ status: "Requested" })).toBe("Released");
    expect(bookingCancellable("Tentative Hold")).toBe(true);
    expect(cancelBooking({ status: "Tentative Hold" })).toBe("Released");
  });

  it("refuses a booking that already holds nothing", () => {
    for (const status of ["Rejected", "Released", "Cancelled", "Expired"] as const) {
      expect(bookingCancellable(status)).toBe(false);
      expect(() => cancelBooking({ status })).toThrow(BookingNotCancellableError);
    }
  });
});

describe("cancellationNotifiesVenueStaff (SPM-63)", () => {
  it("AC1: Venue Staff hear when a Confirmed booking is cancelled", () => {
    expect(cancellationNotifiesVenueStaff("Confirmed")).toBe(true);
  });

  it("AC2: not when a pending request or a hold is cancelled, which they were not preparing for", () => {
    expect(cancellationNotifiesVenueStaff("Requested")).toBe(false);
    expect(cancellationNotifiesVenueStaff("Tentative Hold")).toBe(false);
  });
});

describe("defineBookingTimes (SPM-349)", () => {
  const D = "2026-11-04";

  it("takes the first and the last 15 minutes of a day (AC1)", () => {
    expect(defineBookingTimes([{ date: D, start: "07:00", end: "07:15" }])).toEqual([
      { date: D, start: "07:00", end: "07:15" },
    ]);
    expect(defineBookingTimes([{ date: D, start: "23:45", end: "24:00" }])).toEqual([
      { date: D, start: "23:45", end: "24:00" },
    ]);
  });

  it("takes several dates, in date order (AC1)", () => {
    expect(
      defineBookingTimes([
        { date: "2026-11-05", start: "13:00", end: "18:00" },
        { date: D, start: "07:00", end: "12:00" },
      ]).map((time) => time.date),
    ).toEqual([D, "2026-11-05"]);
  });

  it("refuses a request with no dates", () => {
    expect(() => defineBookingTimes([])).toThrow(NoBookingSlotsError);
  });

  it.each([
    ["date", { date: "", start: "07:00", end: "08:00" }, /Choose a date/],
    ["start", { date: D, start: "", end: "08:00" }, /Choose a start time for 2026-11-04/],
    ["end", { date: D, start: "07:00", end: " " }, /Choose an end time for 2026-11-04/],
  ] as const)("refuses a missing %s, naming it (AC1)", (missing, row, message) => {
    expect(() => defineBookingTimes([row])).toThrow(IncompleteBookingTimeError);
    expect(() => defineBookingTimes([row])).toThrow(message);
  });

  it("refuses a date that is not on the calendar", () => {
    expect(() => defineBookingTimes([{ date: "2026-02-30", start: "07:00", end: "08:00" }])).toThrow(
      InvalidBookingDateError,
    );
  });

  it.each([
    ["a start off the grid", "07:10", "08:00"],
    ["an end off the grid", "07:00", "08:05"],
    ["a start of 24:00", "24:00", "24:00"],
    ["an end equal to the start", "07:00", "07:00"],
    ["an end before the start, crossing midnight", "23:00", "01:00"],
    ["a start that is not a time", "7am", "08:00"],
  ])("refuses %s (AC1)", (_case, start, end) => {
    expect(() => defineBookingTimes([{ date: D, start, end }])).toThrow(InvalidBookingTimeError);
  });

  it("refuses the same date twice", () => {
    expect(() =>
      defineBookingTimes([
        { date: D, start: "07:00", end: "08:00" },
        { date: D, start: "13:00", end: "14:00" },
      ]),
    ).toThrow(DuplicateBookingDateError);
  });
});

describe("clashingTimes (SPM-350)", () => {
  const D = "2026-11-04";
  const want = [{ date: D, start: "15:00", end: "16:00" }];

  function booked(
    start: string,
    end: string,
    status: BookingStatus = "Confirmed",
    holdExpiresAt: Date | null = null,
    date = D,
  ): OccupiedTime {
    return { date, start, end, status, holdExpiresAt };
  }

  it.each([
    ["by 15 minutes at the start", "14:00", "15:15", { start: "15:00", end: "15:15" }],
    ["by 15 minutes at the end", "15:45", "17:00", { start: "15:45", end: "16:00" }],
    ["inside it", "15:15", "15:30", { start: "15:15", end: "15:30" }],
    ["around it", "07:00", "24:00", { start: "15:00", end: "16:00" }],
  ])("names the overlap when a booking overlaps %s (AC2)", (_case, start, end, overlap) => {
    expect(clashingTimes(want, [booked(start, end)], NOW)).toEqual([{ date: D, ...overlap }]);
  });

  it.each([
    ["ends as it starts", "14:00", "15:00"],
    ["starts as it ends", "16:00", "17:00"],
  ])("is no clash when a booking only touches it: %s (AC2)", (_case, start, end) => {
    expect(clashingTimes(want, [booked(start, end)], NOW)).toEqual([]);
  });

  it("joins overlaps with two touching bookings into one range (AC2)", () => {
    expect(clashingTimes(want, [booked("14:00", "15:30"), booked("15:30", "17:00")], NOW)).toEqual(
      want,
    );
  });

  it("is no clash on another date", () => {
    expect(clashingTimes(want, [booked("15:00", "16:00", "Confirmed", null, "2026-11-05")], NOW)).toEqual(
      [],
    );
  });

  it("clashes with a hold still live at now (AC2)", () => {
    expect(clashingTimes(want, [booked("15:00", "16:00", "Tentative Hold", AFTER_NOW)], NOW)).toEqual(
      want,
    );
  });

  it.each(["Requested", "Rejected", "Released", "Cancelled", "Expired"] as const)(
    "is no clash with a booking that is %s (AC3)",
    (status) => {
      expect(clashingTimes(want, [booked("15:00", "16:00", status)], NOW)).toEqual([]);
    },
  );

  it("is no clash with a hold that lapsed before now (AC3)", () => {
    expect(
      clashingTimes(want, [booked("15:00", "16:00", "Tentative Hold", BEFORE_NOW)], NOW),
    ).toEqual([]);
  });
});

describe("paddedClashingTimes (SPM-475)", () => {
  const D = "2026-12-14";
  // Main Hall's values in the SPM-19 example: 30 minutes' setup, 45 minutes' turnaround.
  const MAIN_HALL = { setup: 30, turnaround: 45 };
  const NONE = { setup: 0, turnaround: 0 };
  // Held until 10:00 once its turnaround is counted.
  const charityRun = (status: BookingStatus = "Confirmed", holdExpiresAt: Date | null = null): OccupiedTime => ({
    date: D,
    start: "07:00",
    end: "09:15",
    status,
    holdExpiresAt,
  });

  it("names the padded overlap when setup runs into another booking's turnaround, though the times do not touch", () => {
    expect(
      paddedClashingTimes([{ date: D, start: "10:00", end: "12:00" }], [charityRun()], MAIN_HALL, NOW),
    ).toEqual([{ date: D, start: "09:30", end: "10:00" }]);
  });

  it("is no clash when the padded windows only touch", () => {
    expect(
      paddedClashingTimes([{ date: D, start: "10:30", end: "12:00" }], [charityRun()], MAIN_HALL, NOW),
    ).toEqual([]);
  });

  it("clashes one 15-minute step before the windows touch", () => {
    expect(
      paddedClashingTimes([{ date: D, start: "10:15", end: "12:00" }], [charityRun()], MAIN_HALL, NOW),
    ).toEqual([{ date: D, start: "09:45", end: "10:00" }]);
  });

  it("names the whole padded overlap when the booked times overlap too", () => {
    expect(
      paddedClashingTimes([{ date: D, start: "08:00", end: "09:00" }], [charityRun()], MAIN_HALL, NOW),
    ).toEqual([{ date: D, start: "07:30", end: "09:45" }]);
  });

  it("is the plain overlap check at a venue with no setup or turnaround", () => {
    const want = [{ date: D, start: "09:15", end: "10:00" }];
    expect(paddedClashingTimes(want, [charityRun()], NONE, NOW)).toEqual(
      clashingTimes(want, [charityRun()], NOW),
    );
    expect(paddedClashingTimes(want, [charityRun()], NONE, NOW)).toEqual([]);
  });

  it("pads a live hold like a Confirmed booking", () => {
    expect(
      paddedClashingTimes(
        [{ date: D, start: "10:00", end: "12:00" }],
        [charityRun("Tentative Hold", AFTER_NOW)],
        MAIN_HALL,
        NOW,
      ),
    ).toEqual([{ date: D, start: "09:30", end: "10:00" }]);
  });

  it.each(["Requested", "Rejected", "Released", "Cancelled", "Expired"] as const)(
    "is no clash with a booking that is %s",
    (status) => {
      expect(
        paddedClashingTimes([{ date: D, start: "10:00", end: "12:00" }], [charityRun(status)], MAIN_HALL, NOW),
      ).toEqual([]);
    },
  );

  it("is no clash with a hold that lapsed before now", () => {
    expect(
      paddedClashingTimes(
        [{ date: D, start: "10:00", end: "12:00" }],
        [charityRun("Tentative Hold", BEFORE_NOW)],
        MAIN_HALL,
        NOW,
      ),
    ).toEqual([]);
  });

  it("compares a turnaround that runs past midnight on the next date", () => {
    const nightGala: OccupiedTime = { date: D, start: "22:00", end: "23:30", status: "Confirmed", holdExpiresAt: null };
    expect(
      paddedClashingTimes([{ date: "2026-12-15", start: "00:30", end: "01:00" }], [nightGala], MAIN_HALL, NOW),
    ).toEqual([{ date: "2026-12-15", start: "00:00", end: "00:15" }]);
  });

  it("compares a setup that starts before midnight on the previous date", () => {
    const earlyStart: OccupiedTime = {
      date: "2026-12-15",
      start: "00:15",
      end: "02:00",
      status: "Confirmed",
      holdExpiresAt: null,
    };
    expect(
      paddedClashingTimes([{ date: D, start: "22:00", end: "23:30" }], [earlyStart], MAIN_HALL, NOW),
    ).toEqual([
      { date: D, start: "23:45", end: "24:00" },
      { date: "2026-12-15", start: "00:00", end: "00:15" },
    ]);
  });
});

describe("clashDates (SPM-475)", () => {
  it("adds the day either side of each date, once", () => {
    expect(clashDates(["2026-12-14", "2026-12-15"])).toEqual([
      "2026-12-13",
      "2026-12-14",
      "2026-12-15",
      "2026-12-16",
    ]);
  });

  it("crosses month and year ends", () => {
    expect(clashDates(["2026-12-31"])).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });

  it("keeps a date that is not a calendar day as it is, for the times rule to refuse", () => {
    expect(clashDates(["2026-02-30"])).toEqual(["2026-02-30"]);
  });
});

describe("blockedTimes (SPM-347)", () => {
  const D = "2026-11-04";
  const blockOver = (start: string, end: string) =>
    slotCodesFor({ start: toMinutes(start) ?? 0, end: toMinutes(end) ?? 0 }).map((slot) => ({ date: D, slot }));

  it("names the part of a time a block covers, by its hours", () => {
    expect(
      blockedTimes([{ date: D, start: "11:00", end: "14:00" }], [...blockOver("07:00", "12:00"), ...blockOver("13:00", "18:00")]),
    ).toEqual([
      { date: D, start: "11:00", end: "12:00" },
      { date: D, start: "13:00", end: "14:00" },
    ]);
  });

  it("names nothing when the time only touches the block or is on another date", () => {
    expect(
      blockedTimes(
        [
          { date: D, start: "12:00", end: "13:00" },
          { date: "2026-11-05", start: "07:00", end: "08:00" },
        ],
        blockOver("07:00", "12:00"),
      ),
    ).toEqual([]);
  });
});
