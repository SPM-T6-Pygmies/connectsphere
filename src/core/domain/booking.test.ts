import { describe, expect, it } from "vitest";

import {
  checkLayoutCapacity,
  chooseLayoutChange,
  chooseRoomLayout,
  decideBooking,
  DEFAULT_HOLD_HOURS,
  holdsSlot,
  requestVenueBooking,
  resolveHold,
  type BookingForDecision,
  type BookingForHoldResolution,
  type BookingId,
  type BookingStatus,
  type OccupiedSlot,
  type SlotOnDate,
} from "./booking";
import {
  BookingNotDecidableError,
  BookingRoomLayoutNotChangeableError,
  DecisionReasonRequiredError,
  DuplicateBookingSlotError,
  HoldNotLiveError,
  HoldSlotStartedError,
  InvalidBookingDateError,
  NoBookingSlotsError,
  RoomLayoutRequiredError,
  UnsupportedRoomLayoutError,
  VenueSlotUnavailableError,
} from "./errors";
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
    slots: [],
    capacity: null,
    bookingHorizonDays: null,
    layouts: layouts.map((name) => ({ name, capacity: 100 })),
  };
}

/** The clock every rule here reads; a hold expires either side of it. */
const NOW = new Date("2026-10-01T09:00:00+08:00");
const BEFORE_NOW = new Date("2026-10-01T08:59:59+08:00");
const AFTER_NOW = new Date("2026-10-01T09:00:01+08:00");

function occupied(
  date: string,
  slot: SlotOnDate["slot"],
  status: BookingStatus,
  holdExpiresAt: Date | null = null,
): OccupiedSlot {
  return { date, slot, status, holdExpiresAt };
}

function request(
  slots: readonly SlotOnDate[],
  existing: readonly OccupiedSlot[] = [],
  layout: string | null = THEATRE,
) {
  return requestVenueBooking({
    eventId: "event-1",
    venue: venue(),
    roomLayout: layout,
    slots,
    requestedBy: userAccountId("coordinator-1"),
    occupied: existing,
    now: NOW,
  });
}

describe("requestVenueBooking (SPM-46)", () => {
  it("records one venue, one slot and the event as a Requested booking (AC1)", () => {
    expect(request([{ date: "2026-10-05", slot: "AM" }])).toEqual({
      eventId: "event-1",
      venueId: "venue-1",
      roomLayout: THEATRE,
      slots: [{ date: "2026-10-05", slot: "AM" }],
      requestedBy: "coordinator-1",
      status: "Requested",
    });
  });

  it("takes several slots on several days, in date then slot order (AC1)", () => {
    const booking = request([
      { date: "2026-10-06", slot: "AM" },
      { date: "2026-10-05", slot: "Night" },
      { date: "2026-10-05", slot: "AM" },
    ]);

    expect(booking.slots).toEqual([
      { date: "2026-10-05", slot: "AM" },
      { date: "2026-10-05", slot: "Night" },
      { date: "2026-10-06", slot: "AM" },
    ]);
  });

  it("refuses a request with no slots", () => {
    expect(() => request([])).toThrow(NoBookingSlotsError);
  });

  it("refuses the same slot on the same day twice", () => {
    expect(() =>
      request([
        { date: "2026-10-05", slot: "PM" },
        { date: "2026-10-05", slot: "PM" },
      ]),
    ).toThrow(DuplicateBookingSlotError);
  });

  it.each(["2026-02-30", "2026-13-01", "05/10/2026", ""])(
    "refuses %j, which is not a calendar date",
    (date) => {
      expect(() => request([{ date, slot: "AM" }])).toThrow(InvalidBookingDateError);
    },
  );

  it("blocks outright a slot that already carries a Confirmed booking at the venue (AC4)", () => {
    expect(() =>
      request([{ date: "2026-10-05", slot: "PM" }], [occupied("2026-10-05", "PM", "Confirmed")]),
    ).toThrow(VenueSlotUnavailableError);
  });

  it("names only the clashing slots when some of a multi-slot request are free (AC4)", () => {
    let caught: unknown;
    try {
      request(
        [
          { date: "2026-10-05", slot: "AM" },
          { date: "2026-10-05", slot: "PM" },
          { date: "2026-10-06", slot: "AM" },
        ],
        [occupied("2026-10-05", "PM", "Confirmed"), occupied("2026-10-06", "AM", "Confirmed")],
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VenueSlotUnavailableError);
    expect((caught as VenueSlotUnavailableError).slots).toEqual([
      { date: "2026-10-05", slot: "PM" },
      { date: "2026-10-06", slot: "AM" },
    ]);
  });

  it("blocks a slot on tentative hold too -- one hold or booking per slot (#41)", () => {
    expect(() =>
      request(
        [{ date: "2026-10-05", slot: "AM" }],
        [occupied("2026-10-05", "AM", "Tentative Hold", AFTER_NOW)],
      ),
    ).toThrow(VenueSlotUnavailableError);
  });

  it("does not block on a hold that expired before now (AC4)", () => {
    expect(
      request(
        [{ date: "2026-10-05", slot: "AM" }],
        [occupied("2026-10-05", "AM", "Tentative Hold", BEFORE_NOW)],
      ).status,
    ).toBe("Requested");
  });

  it("does not block on a hold expiring exactly now -- it holds only while expiry is later (AC4)", () => {
    expect(
      request(
        [{ date: "2026-10-05", slot: "AM" }],
        [occupied("2026-10-05", "AM", "Tentative Hold", NOW)],
      ).status,
    ).toBe("Requested");
  });

  it("blocks on a hold with no expiry, which counts as live (AC4)", () => {
    expect(() =>
      request([{ date: "2026-10-05", slot: "AM" }], [occupied("2026-10-05", "AM", "Tentative Hold", null)]),
    ).toThrow(VenueSlotUnavailableError);
  });

  it.each<BookingStatus>(["Requested", "Rejected", "Released", "Cancelled"])(
    "does not block on a %s booking of the same slot -- it holds nothing",
    (status) => {
      expect(
        request([{ date: "2026-10-05", slot: "AM" }], [occupied("2026-10-05", "AM", status)]).status,
      ).toBe("Requested");
    },
  );

  it("allows the adjacent slot to a Confirmed booking (buffers are a known gap, #123)", () => {
    expect(
      request([{ date: "2026-10-05", slot: "PM" }], [occupied("2026-10-05", "AM", "Confirmed")])
        .slots,
    ).toEqual([{ date: "2026-10-05", slot: "PM" }]);
  });

  it("allows the same slot on a different day", () => {
    expect(
      request([{ date: "2026-10-06", slot: "AM" }], [occupied("2026-10-05", "AM", "Confirmed")])
        .status,
    ).toBe("Requested");
  });

  it("needs a layout when the venue supports more than one (AC2)", () => {
    expect(() => request([{ date: "2026-10-05", slot: "AM" }], [], null)).toThrow(
      RoomLayoutRequiredError,
    );
  });
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
    slots: [
      { date: "2026-10-22", slot: "AM" },
      { date: "2026-10-22", slot: "PM" },
    ],
  };

  it("approving confirms the booking and records who decided", () => {
    expect(decideBooking(waiting, { kind: "approve" }, staff, [], NOW)).toEqual({
      id: waiting.id,
      status: "Confirmed",
      decidedBy: staff,
      rejectionNote: null,
      suggestedAlternative: null,
    });
  });

  it("approving is blocked when another booking holds one of its slots", () => {
    for (const status of ["Confirmed", "Tentative Hold"] as const) {
      expect(() =>
        decideBooking(waiting, { kind: "approve" }, staff, [occupied("2026-10-22", "PM", status)], NOW),
      ).toThrow(VenueSlotUnavailableError);
    }
  });

  it("approving is blocked by a hold that has not expired yet", () => {
    expect(() =>
      decideBooking(
        waiting,
        { kind: "approve" },
        staff,
        [occupied("2026-10-22", "AM", "Tentative Hold", AFTER_NOW)],
        NOW,
      ),
    ).toThrow(VenueSlotUnavailableError);
  });

  it("approving is not blocked by a hold that expired before now", () => {
    expect(
      decideBooking(
        waiting,
        { kind: "approve" },
        staff,
        [occupied("2026-10-22", "AM", "Tentative Hold", BEFORE_NOW)],
        NOW,
      ).status,
    ).toBe("Confirmed");
  });

  it("approving is not blocked by requests, rejections or releases on the same slot", () => {
    const others = (["Requested", "Rejected", "Released", "Cancelled"] as const).map((status) =>
      occupied("2026-10-22", "AM", status),
    );

    expect(decideBooking(waiting, { kind: "approve" }, staff, others, NOW).status).toBe("Confirmed");
  });

  it("approving is not blocked by a hold on a different slot or day", () => {
    const elsewhere = [
      occupied("2026-10-22", "Night", "Confirmed"),
      occupied("2026-10-23", "AM", "Confirmed"),
    ];

    expect(decideBooking(waiting, { kind: "approve" }, staff, elsewhere, NOW).status).toBe("Confirmed");
  });

  it("rejecting keeps the trimmed reason and the suggested alternative", () => {
    expect(
      decideBooking(
        waiting,
        { kind: "reject", reason: "  Closed for maintenance  ", suggestedAlternative: venueId("v2") },
        staff,
        [],
        NOW,
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
        decideBooking(waiting, { kind: "reject", reason, suggestedAlternative: null }, staff, [], NOW),
      ).toThrow(DecisionReasonRequiredError);
    }
  });

  it("rejecting is not held up by a clash, since it holds nothing", () => {
    const taken = [occupied("2026-10-22", "AM", "Confirmed")];

    expect(
      decideBooking(waiting, { kind: "reject", reason: "No", suggestedAlternative: null }, staff, taken, NOW)
        .status,
    ).toBe("Rejected");
  });

  it("refuses a booking that is no longer waiting, whichever way it is decided", () => {
    for (const status of ["Tentative Hold", "Confirmed", "Rejected", "Released", "Cancelled"] as const) {
      const decided = { ...waiting, status };
      expect(() => decideBooking(decided, { kind: "approve" }, staff, [], NOW)).toThrow(
        BookingNotDecidableError,
      );
      expect(() =>
        decideBooking(decided, { kind: "reject", reason: "No", suggestedAlternative: null }, staff, [], NOW),
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
    slots: [
      { date: "2026-10-22", slot: "AM" },
      { date: "2026-10-22", slot: "PM" },
    ],
  };
  const hold = { kind: "hold" } as const;

  it("a hold lasts 72 hours, set in one place", () => {
    expect(DEFAULT_HOLD_HOURS).toBe(72);
  });

  it("holding a request puts it on hold, records who, and expires it 72 hours after now (AC1)", () => {
    const decided = decideBooking(waiting, hold, staff, [], NOW);

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
      expect(() => decideBooking({ ...waiting, status }, hold, staff, [], NOW)).toThrow(
        BookingNotDecidableError,
      );
    }
  });

  it("is refused when a Confirmed booking or a live hold has one of its slots, naming it (AC2)", () => {
    const confirmed = occupied("2026-10-22", "PM", "Confirmed");
    const live = occupied("2026-10-22", "AM", "Tentative Hold", AFTER_NOW);

    expect(() => decideBooking(waiting, hold, staff, [confirmed], NOW)).toThrow(VenueSlotUnavailableError);
    expect(() => decideBooking(waiting, hold, staff, [live], NOW)).toThrow(VenueSlotUnavailableError);
    try {
      decideBooking(waiting, hold, staff, [confirmed, live], NOW);
      expect.unreachable();
    } catch (error) {
      expect((error as VenueSlotUnavailableError).slots).toEqual([
        { date: "2026-10-22", slot: "AM" },
        { date: "2026-10-22", slot: "PM" },
      ]);
    }
  });

  it("is not refused by a hold that has already expired, nor one expiring exactly now (AC2)", () => {
    expect(
      decideBooking(waiting, hold, staff, [occupied("2026-10-22", "AM", "Tentative Hold", BEFORE_NOW)], NOW).status,
    ).toBe("Tentative Hold");
    expect(
      decideBooking(waiting, hold, staff, [occupied("2026-10-22", "AM", "Tentative Hold", NOW)], NOW).status,
    ).toBe("Tentative Hold");
  });

  it("is not refused by a request still waiting, or by a rejected, released or cancelled booking (AC2)", () => {
    const others = (["Requested", "Rejected", "Released", "Cancelled"] as const).map((status) =>
      occupied("2026-10-22", "AM", status),
    );

    expect(decideBooking(waiting, hold, staff, others, NOW).status).toBe("Tentative Hold");
  });

  it("is not refused by a booking on a different slot or day (AC2)", () => {
    const elsewhere = [occupied("2026-10-22", "Night", "Confirmed"), occupied("2026-10-23", "AM", "Confirmed")];

    expect(decideBooking(waiting, hold, staff, elsewhere, NOW).status).toBe("Tentative Hold");
  });

  it("needs no reason, and approving or rejecting still carry no expiry", () => {
    expect(decideBooking(waiting, { kind: "approve" }, staff, [], NOW).holdExpiresAt).toBeUndefined();
    expect(
      decideBooking(waiting, { kind: "reject", reason: "No", suggestedAlternative: null }, staff, [], NOW)
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
  const waitingOn = (...slots: SlotOnDate[]): BookingForDecision => ({
    id: "booking-1" as BookingId,
    venueId: venueId("v1"),
    status: "Requested",
    slots,
  });
  // NOW is 2026-10-01 09:00 in Singapore. AM starts at 07:00, PM at 13:00.
  const SEVENTY_TWO_HOURS = DEFAULT_HOLD_HOURS * 60 * 60 * 1000;

  it("expires at the slot's start when that is sooner than 72 hours (AC7)", () => {
    const decided = decideBooking(waitingOn({ date: "2026-10-02", slot: "AM" }), hold, staff, [], NOW);

    expect(decided.holdExpiresAt).toEqual(new Date("2026-10-02T07:00:00+08:00"));
  });

  it("keeps the 72-hour default when the slot starts later than that (AC7)", () => {
    const decided = decideBooking(waitingOn({ date: "2026-10-22", slot: "AM" }), hold, staff, [], NOW);

    expect(decided.holdExpiresAt!.getTime() - NOW.getTime()).toBe(SEVENTY_TWO_HOURS);
  });

  it("is capped at the slot's start when the slot starts exactly 72 hours out (AC7 boundary)", () => {
    // 2026-10-04 09:00 is exactly 72 hours after NOW; no slot starts then, so use a PM-before and an AM-after.
    const justBefore = decideBooking(waitingOn({ date: "2026-10-04", slot: "AM" }), hold, staff, [], NOW);
    const justAfter = decideBooking(waitingOn({ date: "2026-10-04", slot: "PM" }), hold, staff, [], NOW);

    expect(justBefore.holdExpiresAt).toEqual(new Date("2026-10-04T07:00:00+08:00"));
    expect(justAfter.holdExpiresAt).toEqual(new Date("2026-10-04T09:00:00+08:00"));
  });

  it("takes the earliest slot when the booking holds several (AC7)", () => {
    const decided = decideBooking(
      waitingOn({ date: "2026-10-03", slot: "PM" }, { date: "2026-10-02", slot: "PM" }),
      hold,
      staff,
      [],
      NOW,
    );

    expect(decided.holdExpiresAt).toEqual(new Date("2026-10-02T13:00:00+08:00"));
  });

  it("refuses a hold on a slot that has started, or starts this instant (AC7)", () => {
    expect(() => decideBooking(waitingOn({ date: "2026-10-01", slot: "AM" }), hold, staff, [], NOW)).toThrow(
      HoldSlotStartedError,
    );
    const startsNow = new Date("2026-10-01T13:00:00+08:00");
    expect(() => decideBooking(waitingOn({ date: "2026-10-01", slot: "PM" }), hold, staff, [], startsNow)).toThrow(
      HoldSlotStartedError,
    );
  });

  it("refuses the whole hold when any one of its slots has started (AC7)", () => {
    expect(() =>
      decideBooking(
        waitingOn({ date: "2026-10-01", slot: "AM" }, { date: "2026-10-05", slot: "AM" }),
        hold,
        staff,
        [],
        NOW,
      ),
    ).toThrow(HoldSlotStartedError);
  });

  it("does not cap or refuse an approval: only a hold lapses (AC7)", () => {
    const decided = decideBooking(waitingOn({ date: "2026-10-02", slot: "AM" }), { kind: "approve" }, staff, [], NOW);

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
