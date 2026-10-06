import { describe, expect, it } from "vitest";

import {
  InvalidBookingDateError,
  InvalidUnavailabilityReasonError,
  NoUnavailabilitySlotsError,
  UnavailabilityEndsBeforeStartError,
  UnavailabilityInThePastError,
  UnavailabilityNoteNotAllowedError,
  UnavailabilityNoteTooLongError,
} from "./errors";
import { venueId } from "./venue";
import {
  UNAVAILABILITY_REASONS,
  defineVenueUnavailability,
  type NewVenueUnavailability,
} from "./venue-unavailability";

const TIME_ZONE = "Asia/Singapore";
/** 12:00 on Monday 5 October 2026 in Singapore. */
const NOW = new Date("2026-10-05T04:00:00Z");

function block(overrides: Partial<NewVenueUnavailability> = {}) {
  return defineVenueUnavailability({
    details: {
      venueId: venueId("venue-1"),
      startDate: "2026-10-12",
      endDate: "2026-10-12",
      slots: ["AM"],
      reason: "Maintenance",
      note: null,
      ...overrides,
    },
    now: NOW,
    timeZone: TIME_ZONE,
  });
}

describe("defineVenueUnavailability (SPM-265)", () => {
  it("AC1: puts the same slots on every day from the start date to the end date", () => {
    const result = block({ startDate: "2026-10-12", endDate: "2026-10-14", slots: ["PM", "AM"] });

    expect(result.slots).toEqual([
      { date: "2026-10-12", slot: "AM" },
      { date: "2026-10-12", slot: "PM" },
      { date: "2026-10-13", slot: "AM" },
      { date: "2026-10-13", slot: "PM" },
      { date: "2026-10-14", slot: "AM" },
      { date: "2026-10-14", slot: "PM" },
    ]);
  });

  it("AC1: lists a slot ticked twice once", () => {
    expect(block({ slots: ["AM", "AM"] }).slots).toEqual([{ date: "2026-10-12", slot: "AM" }]);
  });

  describe("slots", () => {
    it("AC3: accepts a block with one slot", () => {
      expect(block({ slots: ["Night"] }).slots).toEqual([{ date: "2026-10-12", slot: "Night" }]);
    });

    it("AC3: refuses a block with no slot", () => {
      expect(() => block({ slots: [] })).toThrow(NoUnavailabilitySlotsError);
    });
  });

  describe("dates", () => {
    it("AC4: accepts a start date equal to the end date", () => {
      expect(block({ startDate: "2026-10-12", endDate: "2026-10-12" }).slots).toHaveLength(1);
    });

    it("AC4: refuses a start date one day after the end date", () => {
      expect(() => block({ startDate: "2026-10-13", endDate: "2026-10-12" })).toThrow(
        UnavailabilityEndsBeforeStartError,
      );
    });

    it("AC4: refuses a date that is not a real day", () => {
      expect(() => block({ startDate: "2026-02-30", endDate: "2026-03-01" })).toThrow(
        InvalidBookingDateError,
      );
    });

    it("AC5: accepts a block ending today", () => {
      expect(block({ startDate: "2026-10-05", endDate: "2026-10-05" }).endDate).toBe("2026-10-05");
    });

    it("AC5: refuses a block ending yesterday", () => {
      expect(() => block({ startDate: "2026-10-04", endDate: "2026-10-04" })).toThrow(
        UnavailabilityInThePastError,
      );
    });

    it("AC5: reads today in the venue's time zone, not UTC", () => {
      // 01:00 on 5 October in Singapore is still 4 October in UTC.
      const justAfterMidnight = new Date("2026-10-04T17:00:00Z");

      expect(() =>
        defineVenueUnavailability({
          details: {
            venueId: venueId("venue-1"),
            startDate: "2026-10-04",
            endDate: "2026-10-04",
            slots: ["AM"],
            reason: "Maintenance",
            note: null,
          },
          now: justAfterMidnight,
          timeZone: TIME_ZONE,
        }),
      ).toThrow(UnavailabilityInThePastError);
    });
  });

  describe("reason", () => {
    it.each(UNAVAILABILITY_REASONS)("AC6: accepts %s", (reason) => {
      expect(block({ reason }).reason).toBe(reason);
    });

    it.each(["Holiday", "", "maintenance"])("AC6: refuses the reason %j", (reason) => {
      expect(() => block({ reason })).toThrow(InvalidUnavailabilityReasonError);
    });
  });

  describe("note", () => {
    it("AC7: accepts a note under Other", () => {
      expect(block({ reason: "Other", note: "Film shoot" }).note).toBe("Film shoot");
    });

    it.each(["Maintenance", "Equipment failure", "Renovation", "Safety"])(
      "AC7: refuses a note under %s",
      (reason) => {
        expect(() => block({ reason, note: "Leaking roof" })).toThrow(
          UnavailabilityNoteNotAllowedError,
        );
      },
    );

    it("AC7: treats a blank note as no note, under any reason", () => {
      expect(block({ reason: "Safety", note: "   " }).note).toBeNull();
    });

    it("AC8: accepts a 500-character note", () => {
      expect(block({ reason: "Other", note: "x".repeat(500) }).note).toHaveLength(500);
    });

    it("AC8: refuses a 501-character note", () => {
      expect(() => block({ reason: "Other", note: "x".repeat(501) })).toThrow(
        UnavailabilityNoteTooLongError,
      );
    });
  });
});
