import { describe, expect, it } from "vitest";

import {
  blockFlagDetail,
  bookingsToFlagForBlock,
  bookingWindow,
  flagsToClear,
  timeSpans,
  windowsOverlap,
  type FlaggingBlock,
  VENUE_UNAVAILABLE_FLAG,
  type FlaggableBooking,
} from "./booking-review-flag";
import { NoFlagToClearError } from "./errors";
import { slotCodesFor } from "./slot-grid";
import { toMinutes } from "./time-of-day";
import { venueId } from "./venue";
import type { VenueUnavailabilityEntry } from "./venue-unavailability";

const MAIN_HALL = venueId("5");
const STUDIO = venueId("6");
const NOW = new Date("2026-10-20T10:15:00+08:00");

/** The 15-minute slots from `start` to `end` on `date`, as a booking or block holds them (SPM-331). */
function slotsOf(date: string, start: string, end: string) {
  return slotCodesFor({ start: toMinutes(start) ?? 0, end: toMinutes(end) ?? 0 }).map((slot) => ({ date, slot }));
}

function block(overrides: Partial<VenueUnavailabilityEntry> = {}): VenueUnavailabilityEntry {
  return {
    id: "7",
    venueId: MAIN_HALL,
    venueLocation: "Main Hall",
    startDate: "2026-11-06",
    endDate: "2026-11-06",
    reason: "Maintenance",
    note: null,
    slots: slotsOf("2026-11-06", "13:00", "18:00"),
    status: "In force",
    recordedByName: "Test Venue Staff",
    recordedAt: "2026-10-20T02:15:00.000Z",
    liftedByName: null,
    liftedAt: null,
    ...overrides,
  };
}

function booking(overrides: Partial<FlaggableBooking> = {}): FlaggableBooking {
  return {
    id: "812",
    venueId: MAIN_HALL,
    status: "Confirmed",
    holdExpiresAt: null,
    slots: slotsOf("2026-11-06", "13:00", "18:00"),
    ...overrides,
  };
}

describe("bookingsToFlagForBlock (SPM-313)", () => {
  it("AC1: flags a Confirmed booking the block covers, with the block's date, times and reason", () => {
    const [flagged] = bookingsToFlagForBlock(block(), [booking()], NOW);

    expect(flagged?.bookingId).toBe("812");
    expect(flagged?.reason).toEqual({
      code: VENUE_UNAVAILABLE_FLAG,
      sourceBlockId: "7",
      detail: "Maintenance: 2026-11-06 13:00 to 18:00",
    });
  });

  it("AC1: flags a Tentative Hold that has not run out", () => {
    const hold = booking({ status: "Tentative Hold", holdExpiresAt: new Date("2026-10-22T10:15:00+08:00") });

    expect(bookingsToFlagForBlock(block(), [hold], NOW).map((f) => f.bookingId)).toEqual(["812"]);
  });

  it("AC1: leaves a hold that has run out, because it holds nothing", () => {
    const lapsed = booking({ status: "Tentative Hold", holdExpiresAt: new Date("2026-10-19T10:15:00+08:00") });

    expect(bookingsToFlagForBlock(block(), [lapsed], NOW)).toEqual([]);
  });

  it.each(["Requested", "Rejected", "Released", "Cancelled", "Expired"] as const)(
    "AC1: leaves a %s booking alone",
    (status) => {
      expect(bookingsToFlagForBlock(block(), [booking({ status })], NOW)).toEqual([]);
    },
  );

  it("AC2: leaves other slots on the same day, other days and other venues alone", () => {
    const others = [
      booking({ id: "1", slots: slotsOf("2026-11-06", "07:00", "12:00") }),
      booking({ id: "2", slots: slotsOf("2026-11-06", "19:00", "24:00") }),
      booking({ id: "3", slots: slotsOf("2026-11-07", "13:00", "18:00") }),
      booking({ id: "4", venueId: STUDIO }),
    ];

    expect(bookingsToFlagForBlock(block(), others, NOW)).toEqual([]);
  });

  it("AC2: a booking over only some of its slots is flagged for those, naming them", () => {
    const twoDays = booking({
      slots: [...slotsOf("2026-11-05", "13:00", "18:00"), ...slotsOf("2026-11-06", "13:00", "18:00")],
    });

    const [flagged] = bookingsToFlagForBlock(block(), [twoDays], NOW);

    expect(flagged?.reason.detail).toBe("Maintenance: 2026-11-06 13:00 to 18:00");
  });

  it("AC5: two blocks over one booking give two reasons, each named by its block", () => {
    const renovation = block({ id: "1", reason: "Renovation", startDate: "2026-11-06", endDate: "2026-11-07" });
    const aircon = block({ id: "2", reason: "Equipment failure", endDate: "2026-11-14" });

    const reasons = [renovation, aircon].flatMap((b) => bookingsToFlagForBlock(b, [booking()], NOW));

    expect(reasons.map((f) => f.reason.sourceBlockId)).toEqual(["1", "2"]);
    expect(reasons.map((f) => f.reason.detail)).toEqual([
      "Renovation: 2026-11-06 13:00 to 18:00",
      "Equipment failure: 2026-11-06 13:00 to 18:00",
    ]);
  });

  it("AC5: the same block gives the same reason each time, so a repeat can be recognised", () => {
    const first = bookingsToFlagForBlock(block(), [booking()], NOW);
    const second = bookingsToFlagForBlock(block(), [booking()], NOW);

    expect(second).toEqual(first);
  });

  it("AC6: a lifted block flags nothing new", () => {
    const lifted = block({ status: "Lifted", liftedAt: "2026-10-21T01:00:00.000Z" });

    expect(bookingsToFlagForBlock(lifted, [booking()], NOW)).toEqual([]);
  });

  it("AC7: flags only the booking the block covers when an event has several venues", () => {
    const hallA = booking({ id: "812", venueId: MAIN_HALL });
    const hallC = booking({ id: "813", venueId: STUDIO });

    expect(bookingsToFlagForBlock(block(), [hallA, hallC], NOW).map((f) => f.bookingId)).toEqual(["812"]);
  });
});

describe("blockFlagDetail (SPM-313)", () => {
  it("AC1: gives a block's hours as the slot table does, ending at 24:00", () => {
    const night = block({ slots: slotsOf("2026-11-06", "19:00", "24:00") });

    expect(blockFlagDetail(night, slotsOf("2026-11-06", "19:00", "24:00"))).toBe(
      "Maintenance: 2026-11-06 19:00 to 24:00",
    );
  });

  it("AC6: leaves a lift out of the text: the page shows it from the block, so it can stand out", () => {
    const lifted = block({ status: "Lifted", liftedAt: "2026-10-21T01:00:00.000Z" });

    expect(blockFlagDetail(lifted, slotsOf("2026-11-06", "13:00", "18:00"))).toBe(
      "Maintenance: 2026-11-06 13:00 to 18:00",
    );
  });
});

describe("windowsOverlap (SPM-313)", () => {
  const at = (start: string, end: string) => ({
    startsAt: new Date(`2026-11-06T${start}:00+08:00`),
    endsAt: new Date(`2026-11-06T${end}:00+08:00`),
  });

  it("AC2: touching is not overlapping", () => {
    expect(windowsOverlap(at("13:00", "15:00"), at("15:00", "18:00"))).toBe(false);
    expect(windowsOverlap(at("15:00", "18:00"), at("13:00", "15:00"))).toBe(false);
  });

  it("AC1: fifteen minutes of overlap is overlapping", () => {
    expect(windowsOverlap(at("13:00", "15:15"), at("15:00", "18:00"))).toBe(true);
  });

  it("a booking window is the slot's own hours until padding is defined (SPM-23)", () => {
    expect(bookingWindow({ date: "2026-11-06", slot: "52" })).toEqual(at("13:00", "13:15"));
  });
});

/** Slot codes '52' to '71': twenty 15-minute slots, 13:00 to 18:00 (SPM-331). */
const AFTERNOON = slotsOf("2026-11-06", "13:00", "18:00");

function quarterBlock(...codes: string[]): FlaggingBlock {
  return {
    id: "9",
    venueId: MAIN_HALL,
    reason: "Maintenance",
    status: "In force",
    slots: codes.map((slot) => ({ date: "2026-11-06", slot })),
  };
}

describe("flagging on the 15-minute grid (SPM-313, SPM-331)", () => {
  it("AC1: flags a booking of twenty 15-minute slots for a block inside it, naming the block's own time", () => {
    const [flagged] = bookingsToFlagForBlock(
      quarterBlock("60", "61"),
      [booking({ slots: AFTERNOON })],
      NOW,
    );

    expect(flagged?.reason.detail).toBe("Maintenance: 2026-11-06 15:00 to 15:30");
  });

  it("AC1: flags a booking inside a longer block, naming only the part of the block it falls in", () => {
    const [flagged] = bookingsToFlagForBlock(
      block(),
      [booking({ slots: [{ date: "2026-11-06", slot: "60" }] })],
      NOW,
    );

    expect(flagged?.reason.detail).toBe("Maintenance: 2026-11-06 15:00 to 15:15");
  });

  it("AC2: leaves a booking alone when the block starts the moment it ends, or ends the moment it starts", () => {
    expect(bookingsToFlagForBlock(quarterBlock("72"), [booking({ slots: AFTERNOON })], NOW)).toEqual([]);
    expect(bookingsToFlagForBlock(quarterBlock("51"), [booking({ slots: AFTERNOON })], NOW)).toEqual([]);
  });

  it("AC2: leaves a booking alone when the block is on another date's slot of the same code", () => {
    const otherDay = { ...quarterBlock("60"), slots: [{ date: "2026-11-07", slot: "60" }] };

    expect(bookingsToFlagForBlock(otherDay, [booking({ slots: AFTERNOON })], NOW)).toEqual([]);
  });

});

describe("timeSpans (SPM-313, SPM-331)", () => {
  it("reads twenty 15-minute slots as one span", () => {
    expect(timeSpans(AFTERNOON)).toBe("2026-11-06 13:00 to 18:00");
  });

  it("keeps separate spans apart, in date and time order", () => {
    expect(
      timeSpans([
        ...slotsOf("2026-11-07", "07:00", "12:00"),
        ...slotsOf("2026-11-06", "19:00", "24:00"),
        ...slotsOf("2026-11-06", "07:00", "12:00"),
      ]),
    ).toBe("2026-11-06 07:00 to 12:00, 2026-11-06 19:00 to 24:00, 2026-11-07 07:00 to 12:00");
  });

  it("joins slots that run into each other and counts a slot inside another once", () => {
    expect(
      timeSpans([
        ...AFTERNOON,
        { date: "2026-11-06", slot: "60" },
        { date: "2026-11-06", slot: "72" },
      ]),
    ).toBe("2026-11-06 13:00 to 18:15");
  });

  it("ends the last slot of the day at 24:00", () => {
    expect(timeSpans([{ date: "2026-11-06", slot: "95" }])).toBe("2026-11-06 23:45 to 24:00");
  });

  it("refuses a slot code the slot table does not have", () => {
    expect(() => timeSpans([{ date: "2026-11-06", slot: "96" }])).toThrow(/Unknown slot code/);
  });
});

describe("flagsToClear (SPM-310)", () => {
  const FLAGS = [
    { flagId: "1", bookingId: "812" },
    { flagId: "2", bookingId: "813" },
    { flagId: "3", bookingId: "812" },
  ];

  it("AC1: clears every open reason on the booking, not one", () => {
    expect(flagsToClear(FLAGS, "812").map(({ flagId }) => flagId)).toEqual(["1", "3"]);
  });

  it("AC4: leaves the event's other bookings' reasons out", () => {
    expect(flagsToClear(FLAGS, "813").map(({ flagId }) => flagId)).toEqual(["2"]);
  });

  it("AC6: refuses a booking with no open flag", () => {
    expect(() => flagsToClear(FLAGS, "814")).toThrow(NoFlagToClearError);
    expect(() => flagsToClear([], "812")).toThrow("This booking has no open flag to clear.");
  });
});
