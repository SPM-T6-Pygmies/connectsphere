import { describe, expect, it } from "vitest";

import {
  blockFlagDetail,
  bookingsToFlagForBlock,
  bookingWindow,
  windowsOverlap,
  VENUE_UNAVAILABLE_FLAG,
  type FlaggableBooking,
} from "./booking-review-flag";
import { venueId } from "./venue";
import type { VenueUnavailabilityEntry } from "./venue-unavailability";

const HALL_A = venueId("5");
const HALL_C = venueId("6");
const NOW = new Date("2026-10-20T10:15:00+08:00");

function block(overrides: Partial<VenueUnavailabilityEntry> = {}): VenueUnavailabilityEntry {
  return {
    id: "7",
    venueId: HALL_A,
    venueLocation: "Hall A",
    startDate: "2026-11-06",
    endDate: "2026-11-06",
    reason: "Maintenance",
    note: null,
    slots: [{ date: "2026-11-06", slot: "PM" }],
    status: "In force",
    recordedByName: "Sam",
    recordedAt: "2026-10-20T02:15:00.000Z",
    liftedByName: null,
    liftedAt: null,
    ...overrides,
  };
}

function booking(overrides: Partial<FlaggableBooking> = {}): FlaggableBooking {
  return {
    id: "812",
    venueId: HALL_A,
    status: "Confirmed",
    holdExpiresAt: null,
    slots: [{ date: "2026-11-06", slot: "PM" }],
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
      booking({ id: "1", slots: [{ date: "2026-11-06", slot: "AM" }] }),
      booking({ id: "2", slots: [{ date: "2026-11-06", slot: "Night" }] }),
      booking({ id: "3", slots: [{ date: "2026-11-07", slot: "PM" }] }),
      booking({ id: "4", venueId: HALL_C }),
    ];

    expect(bookingsToFlagForBlock(block(), others, NOW)).toEqual([]);
  });

  it("AC2: a booking over only some of its slots is flagged for those, naming them", () => {
    const twoDays = booking({
      slots: [
        { date: "2026-11-05", slot: "PM" },
        { date: "2026-11-06", slot: "PM" },
      ],
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
    const hallA = booking({ id: "812", venueId: HALL_A });
    const hallC = booking({ id: "813", venueId: HALL_C });

    expect(bookingsToFlagForBlock(block(), [hallA, hallC], NOW).map((f) => f.bookingId)).toEqual(["812"]);
  });
});

describe("blockFlagDetail (SPM-313)", () => {
  it("AC6: says the block was lifted, and when, once it is lifted", () => {
    const lifted = block({ status: "Lifted", liftedAt: "2026-10-21T01:00:00.000Z" });

    expect(blockFlagDetail(lifted, [{ date: "2026-11-06", slot: "PM" }])).toBe(
      "Maintenance: 2026-11-06 13:00 to 18:00, block lifted 2026-10-21T01:00:00.000Z",
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
    expect(bookingWindow({ date: "2026-11-06", slot: "PM" })).toEqual(at("13:00", "18:00"));
  });
});
