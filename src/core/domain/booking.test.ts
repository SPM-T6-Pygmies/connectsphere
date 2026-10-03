import { describe, expect, it } from "vitest";

import {
  chooseRoomLayout,
  decideBooking,
  gridTimes,
  isGridTime,
  slotsOverlap,
  requestVenueBooking,
  type BookingForDecision,
  type BookingId,
  type BookingStatus,
  type OccupiedSlot,
  type SlotOnDate,
} from "./booking";
import {
  BookingNotDecidableError,
  DecisionReasonRequiredError,
  InvalidBookingDateError,
  InvalidBookingTimeError,
  NoBookingSlotsError,
  OutsideOperatingHoursError,
  OverlappingBookingSlotsError,
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
    operatingHoursStart: null,
    operatingHoursEnd: null,
    capacity: null,
    bookingHorizonDays: null,
    layouts: layouts.map((name) => ({ name, capacity: 100 })),
  };
}

function occupied(
  date: string,
  start: string,
  end: string,
  status: BookingStatus,
): OccupiedSlot {
  return { date, start, end, status };
}

function at(date: string, start: string, end: string): SlotOnDate {
  return { date, start, end };
}

function request(
  slots: readonly SlotOnDate[],
  existing: readonly OccupiedSlot[] = [],
  layout: string | null = THEATRE,
  hours: { open: string | null; close: string | null } = {
    open: null,
    close: null,
  },
) {
  return requestVenueBooking({
    eventId: "event-1",
    venue: {
      ...venue(),
      operatingHoursStart: hours.open,
      operatingHoursEnd: hours.close,
    },
    roomLayout: layout,
    slots,
    requestedBy: userAccountId("coordinator-1"),
    occupied: existing,
  });
}

describe("requestVenueBooking (SPM-46)", () => {
  it("records one venue, one start and end time and the event as a Requested booking (AC1)", () => {
    expect(request([at("2026-10-05", "09:00", "11:30")])).toEqual({
      eventId: "event-1",
      venueId: "venue-1",
      roomLayout: THEATRE,
      slots: [at("2026-10-05", "09:00", "11:30")],
      requestedBy: "coordinator-1",
      status: "Requested",
    });
  });

  it("takes several times on several days, in date then start order (AC1)", () => {
    const booking = request([
      at("2026-10-06", "09:00", "10:00"),
      at("2026-10-05", "19:00", "21:00"),
      at("2026-10-05", "08:15", "09:15"),
    ]);

    expect(booking.slots).toEqual([
      at("2026-10-05", "08:15", "09:15"),
      at("2026-10-05", "19:00", "21:00"),
      at("2026-10-06", "09:00", "10:00"),
    ]);
  });

  it("refuses a request with no times", () => {
    expect(() => request([])).toThrow(NoBookingSlotsError);
  });

  it("refuses two times on the same day that overlap, and the same time twice", () => {
    expect(() =>
      request([
        at("2026-10-05", "09:00", "11:00"),
        at("2026-10-05", "10:45", "12:00"),
      ]),
    ).toThrow(OverlappingBookingSlotsError);
    expect(() =>
      request([
        at("2026-10-05", "09:00", "10:00"),
        at("2026-10-05", "09:00", "10:00"),
      ]),
    ).toThrow(OverlappingBookingSlotsError);
  });

  it("allows two times on the same day that only touch, or sit on different days", () => {
    expect(
      request([
        at("2026-10-05", "09:00", "10:00"),
        at("2026-10-05", "10:00", "11:00"),
      ]).slots,
    ).toHaveLength(2);
    expect(
      request([
        at("2026-10-05", "09:00", "10:00"),
        at("2026-10-06", "09:00", "10:00"),
      ]).slots,
    ).toHaveLength(2);
  });

  it.each(["2026-02-30", "2026-13-01", "05/10/2026", ""])(
    "refuses %j, which is not a calendar date",
    (date) => {
      expect(() => request([at(date, "09:00", "10:00")])).toThrow(
        InvalidBookingDateError,
      );
    },
  );

  it.each([
    ["09:10", "10:00"],
    ["09:00", "10:05"],
    ["9:00", "10:00"],
    ["09:00", "09:00"],
    ["10:00", "09:00"],
    ["", "10:00"],
    ["09:00", "25:00"],
  ])(
    "refuses %j to %j: not on the quarter hour, or the end is not after the start",
    (start, end) => {
      expect(() => request([at("2026-10-05", start, end)])).toThrow(
        InvalidBookingTimeError,
      );
    },
  );

  it("accepts a stretch that runs to the end of the day", () => {
    expect(request([at("2026-10-05", "22:00", "24:00")]).slots).toEqual([
      at("2026-10-05", "22:00", "24:00"),
    ]);
  });

  describe("operating hours", () => {
    const hours = { open: "08:00", close: "20:00" };

    it("allows a time inside the venue's hours, and one that fills them exactly", () => {
      expect(
        request([at("2026-10-05", "09:00", "10:00")], [], THEATRE, hours)
          .status,
      ).toBe("Requested");
      expect(
        request([at("2026-10-05", "08:00", "20:00")], [], THEATRE, hours)
          .status,
      ).toBe("Requested");
    });

    it.each([
      ["07:45", "09:00"],
      ["19:00", "20:15"],
      ["06:00", "07:00"],
    ])("refuses %j to %j, which starts or ends outside them", (start, end) => {
      expect(() =>
        request([at("2026-10-05", start, end)], [], THEATRE, hours),
      ).toThrow(OutsideOperatingHoursError);
    });

    it("sets no bound for a venue with no hours on record", () => {
      expect(request([at("2026-10-05", "03:00", "04:00")]).status).toBe(
        "Requested",
      );
    });
  });

  it("blocks outright a time that overlaps a Confirmed booking at the venue (AC4)", () => {
    expect(() =>
      request(
        [at("2026-10-05", "13:00", "14:00")],
        [occupied("2026-10-05", "12:00", "15:00", "Confirmed")],
      ),
    ).toThrow(VenueSlotUnavailableError);
  });

  it("blocks at the edges: one quarter hour of overlap is enough", () => {
    const held = [occupied("2026-10-05", "12:00", "15:00", "Confirmed")];

    expect(() => request([at("2026-10-05", "11:00", "12:15")], held)).toThrow(
      VenueSlotUnavailableError,
    );
    expect(() => request([at("2026-10-05", "14:45", "16:00")], held)).toThrow(
      VenueSlotUnavailableError,
    );
  });

  it("allows a time that starts as a held booking ends, or ends as it starts (buffers are a known gap, #123)", () => {
    const held = [occupied("2026-10-05", "12:00", "15:00", "Confirmed")];

    expect(request([at("2026-10-05", "15:00", "16:00")], held).status).toBe(
      "Requested",
    );
    expect(request([at("2026-10-05", "11:00", "12:00")], held).status).toBe(
      "Requested",
    );
  });

  it("names only the clashing times when some of a multi-time request are free (AC4)", () => {
    let caught: unknown;
    try {
      request(
        [
          at("2026-10-05", "09:00", "10:00"),
          at("2026-10-05", "13:00", "14:00"),
          at("2026-10-06", "09:00", "10:00"),
        ],
        [
          occupied("2026-10-05", "12:00", "15:00", "Confirmed"),
          occupied("2026-10-06", "08:00", "09:30", "Confirmed"),
        ],
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(VenueSlotUnavailableError);
    expect((caught as VenueSlotUnavailableError).slots).toEqual([
      at("2026-10-05", "13:00", "14:00"),
      at("2026-10-06", "09:00", "10:00"),
    ]);
  });

  it("blocks a time on tentative hold too -- one hold or booking at a time (#41)", () => {
    expect(() =>
      request(
        [at("2026-10-05", "09:00", "10:00")],
        [occupied("2026-10-05", "09:00", "10:00", "Tentative Hold")],
      ),
    ).toThrow(VenueSlotUnavailableError);
  });

  it.each<BookingStatus>(["Requested", "Rejected", "Released", "Cancelled"])(
    "does not block on a %s booking of the same time -- it holds nothing",
    (status) => {
      expect(
        request(
          [at("2026-10-05", "09:00", "10:00")],
          [occupied("2026-10-05", "09:00", "10:00", status)],
        ).status,
      ).toBe("Requested");
    },
  );

  it("allows the same time on a different day", () => {
    expect(
      request(
        [at("2026-10-06", "09:00", "10:00")],
        [occupied("2026-10-05", "09:00", "10:00", "Confirmed")],
      ).status,
    ).toBe("Requested");
  });

  it("needs a layout when the venue supports more than one (AC2)", () => {
    expect(() =>
      request([at("2026-10-05", "09:00", "10:00")], [], null),
    ).toThrow(RoomLayoutRequiredError);
  });
});

describe("the 15-minute grid (SPM-46)", () => {
  it("knows which times are on it", () => {
    for (const time of [
      "00:00",
      "07:00",
      "07:15",
      "07:30",
      "07:45",
      "23:45",
      "24:00",
    ]) {
      expect(isGridTime(time)).toBe(true);
    }
    for (const time of ["07:10", "7:00", "07:60", "24:15", "", "noon"]) {
      expect(isGridTime(time)).toBe(false);
    }
  });

  it("lists every quarter hour from one time to another, inclusive", () => {
    expect(gridTimes("07:00", "08:00")).toEqual([
      "07:00",
      "07:15",
      "07:30",
      "07:45",
      "08:00",
    ]);
  });

  it("starts at the first quarter hour when the venue opens off the grid", () => {
    expect(gridTimes("07:05", "07:50")).toEqual(["07:15", "07:30", "07:45"]);
  });

  it("lists nothing for a bound that is not a time", () => {
    expect(gridTimes("", "08:00")).toEqual([]);
  });

  it("sees overlap only on the same day and only with shared time", () => {
    const base = at("2026-10-05", "09:00", "10:00");

    expect(slotsOverlap(base, at("2026-10-05", "09:45", "10:30"))).toBe(true);
    expect(slotsOverlap(base, at("2026-10-05", "10:00", "11:00"))).toBe(false);
    expect(slotsOverlap(base, at("2026-10-05", "08:00", "09:00"))).toBe(false);
    expect(slotsOverlap(base, at("2026-10-06", "09:00", "10:00"))).toBe(false);
    expect(slotsOverlap(base, at("2026-10-05", "09:15", "09:30"))).toBe(true);
  });
});

describe("chooseRoomLayout (SPM-104)", () => {
  it("records the chosen layout as a reference to one the venue supports (AC1)", () => {
    expect(chooseRoomLayout(venue([THEATRE, CLASSROOM]), CLASSROOM)).toBe(
      CLASSROOM,
    );
  });

  it("refuses a layout the venue does not support", () => {
    expect(() =>
      chooseRoomLayout(venue([THEATRE, CLASSROOM]), BANQUET),
    ).toThrow(UnsupportedRoomLayoutError);
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
    expect(() => chooseRoomLayout(venue([THEATRE]), CLASSROOM)).toThrow(
      UnsupportedRoomLayoutError,
    );
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
      at("2026-10-22", "09:00", "12:00"),
      at("2026-10-22", "14:00", "16:00"),
    ],
  };

  it("approving confirms the booking and records who decided", () => {
    expect(decideBooking(waiting, { kind: "approve" }, staff, [])).toEqual({
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
        decideBooking(waiting, { kind: "approve" }, staff, [
          occupied("2026-10-22", "15:00", "17:00", status),
        ]),
      ).toThrow(VenueSlotUnavailableError);
    }
  });

  it("approving is not blocked by requests, rejections or releases on the same slot", () => {
    const others = (
      ["Requested", "Rejected", "Released", "Cancelled"] as const
    ).map((status) => occupied("2026-10-22", "09:00", "12:00", status));

    expect(
      decideBooking(waiting, { kind: "approve" }, staff, others).status,
    ).toBe("Confirmed");
  });

  it("approving is not blocked by a hold on a different time or day, or one that only touches", () => {
    const elsewhere = [
      occupied("2026-10-22", "18:00", "21:00", "Confirmed"),
      occupied("2026-10-23", "09:00", "12:00", "Confirmed"),
      occupied("2026-10-22", "12:00", "14:00", "Confirmed"),
    ];

    expect(
      decideBooking(waiting, { kind: "approve" }, staff, elsewhere).status,
    ).toBe("Confirmed");
  });

  it("rejecting keeps the trimmed reason and the suggested alternative", () => {
    expect(
      decideBooking(
        waiting,
        {
          kind: "reject",
          reason: "  Closed for maintenance  ",
          suggestedAlternative: venueId("v2"),
        },
        staff,
        [],
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
        decideBooking(
          waiting,
          { kind: "reject", reason, suggestedAlternative: null },
          staff,
          [],
        ),
      ).toThrow(DecisionReasonRequiredError);
    }
  });

  it("rejecting is not held up by a clash, since it holds nothing", () => {
    const taken = [occupied("2026-10-22", "09:00", "12:00", "Confirmed")];

    expect(
      decideBooking(
        waiting,
        { kind: "reject", reason: "No", suggestedAlternative: null },
        staff,
        taken,
      ).status,
    ).toBe("Rejected");
  });

  it("refuses a booking that is no longer waiting, whichever way it is decided", () => {
    for (const status of [
      "Tentative Hold",
      "Confirmed",
      "Rejected",
      "Released",
      "Cancelled",
    ] as const) {
      const decided = { ...waiting, status };
      expect(() =>
        decideBooking(decided, { kind: "approve" }, staff, []),
      ).toThrow(BookingNotDecidableError);
      expect(() =>
        decideBooking(
          decided,
          { kind: "reject", reason: "No", suggestedAlternative: null },
          staff,
          [],
        ),
      ).toThrow(BookingNotDecidableError);
    }
  });
});
