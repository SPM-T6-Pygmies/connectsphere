import { describe, expect, it } from "vitest";

import {
  InvalidBookingDateError,
  InvalidUnavailabilityReasonError,
  InvalidUnavailabilityTimeError,
  UnavailabilityEndsBeforeStartError,
  UnavailabilityInThePastError,
  UnavailabilityNoteNotAllowedError,
  UnavailabilityNoteTooLongError,
  UnavailabilityOutsideOpeningHoursError,
} from "./errors";
import type { OpeningWindow } from "./opening-hours";
import { venueId } from "./venue";
import {
  UNAVAILABILITY_REASONS,
  defineVenueUnavailability,
  duplicatesInForceBlock,
  type NewVenueUnavailability,
  type VenueUnavailabilityEntry,
} from "./venue-unavailability";

const TIME_ZONE = "Asia/Singapore";
/** The seeded venues' hours: open mornings, afternoons and evenings, closed 12:00-13:00 and 18:00-19:00. */
const HOURS: OpeningWindow[] = [
  { start: "07:00", end: "12:00" },
  { start: "13:00", end: "18:00" },
  { start: "19:00", end: "24:00" },
];
/** 12:00 on Monday 5 October 2026 in Singapore. */
const NOW = new Date("2026-10-05T04:00:00Z");

function block(overrides: Partial<NewVenueUnavailability> = {}, openingHours: OpeningWindow[] = HOURS) {
  return defineVenueUnavailability({
    details: {
      venueId: venueId("venue-1"),
      startDate: "2026-10-12",
      endDate: "2026-10-12",
      startTime: "09:00",
      endTime: "11:30",
      reason: "Maintenance",
      note: null,
      ...overrides,
    },
    openingHours,
    now: NOW,
    timeZone: TIME_ZONE,
  });
}

describe("defineVenueUnavailability (SPM-265)", () => {
  it("AC1: puts the same slots on every day from the start date to the end date", () => {
    const result = block({ startDate: "2026-10-12", endDate: "2026-10-14", startTime: "09:00", endTime: "09:30" });

    expect(result.slots).toEqual([
      { date: "2026-10-12", slot: "36" },
      { date: "2026-10-12", slot: "37" },
      { date: "2026-10-13", slot: "36" },
      { date: "2026-10-13", slot: "37" },
      { date: "2026-10-14", slot: "36" },
      { date: "2026-10-14", slot: "37" },
    ]);
  });

  describe("dates", () => {
    it("AC4: accepts a start date equal to the end date", () => {
      expect(block({ startDate: "2026-10-12", endDate: "2026-10-12" }).slots).toHaveLength(10);
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

    it("AC5: accepts a block ending later today", () => {
      expect(block({ startDate: "2026-10-05", endDate: "2026-10-05", startTime: "13:00", endTime: "18:00" }).endDate).toBe(
        "2026-10-05",
      );
    });

    it("AC5: refuses a block that ends at this very minute and accepts one ending later today", () => {
      // Now is 12:00. A block ending 12:00 has just ended; one ending 13:15 has not.
      expect(() =>
        block({ startDate: "2026-10-05", endDate: "2026-10-05", startTime: "11:00", endTime: "12:00" }),
      ).toThrow(UnavailabilityInThePastError);
      expect(block({ startDate: "2026-10-05", endDate: "2026-10-05", startTime: "13:00", endTime: "13:15" }).slots).toEqual([
        { date: "2026-10-05", slot: "52" },
      ]);
    });

    it("AC5: refuses a block ending yesterday", () => {
      expect(() => block({ startDate: "2026-10-04", endDate: "2026-10-04" })).toThrow(
        "A block cannot end in the past (2026-10-04 11:30).",
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
            startTime: "09:00",
            endTime: "11:30",
            reason: "Maintenance",
            note: null,
          },
          openingHours: HOURS,
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

describe("defineVenueUnavailability by time of day (SPM-321)", () => {
  it("AC3: covers 09:00 to 11:30 with the ten 15-minute slots 36 to 45", () => {
    expect(block({ startTime: "09:00", endTime: "11:30" }).slots.map(({ slot }) => slot)).toEqual([
      "36", "37", "38", "39", "40", "41", "42", "43", "44", "45",
    ]);
  });

  it("AC3: accepts the shortest block, one quarter hour, and the longest open stretch of a day", () => {
    expect(block({ startTime: "07:00", endTime: "07:15" }).slots).toEqual([{ date: "2026-10-12", slot: "28" }]);
    expect(block({ startTime: "19:00", endTime: "24:00" }).slots).toHaveLength(20);
  });

  it("AC3: reads 24:00 as the end of the day and refuses it as a start", () => {
    expect(block({ startTime: "23:45", endTime: "24:00" }).slots).toEqual([{ date: "2026-10-12", slot: "95" }]);
    expect(() => block({ startTime: "24:00", endTime: "24:00" })).toThrow(InvalidUnavailabilityTimeError);
  });

  it.each([
    ["09:10", "11:30", "09:10 is not on the 15-minute grid"],
    ["09:00", "11:20", "11:20 is not on the 15-minute grid"],
    ["", "11:30", "A blank is not a time"],
    ["9am", "11:30", "9am is not a time"],
    ["25:00", "26:00", "25:00 is not a time"],
  ])("AC3: refuses the times %j to %j: %s", (startTime, endTime, why) => {
    expect(() => block({ startTime, endTime })).toThrow(InvalidUnavailabilityTimeError);
    expect(() => block({ startTime, endTime })).toThrow(why);
  });

  it.each([
    ["11:30", "09:00"],
    ["09:00", "09:00"],
  ])("AC3: refuses an end that is not after the start (%s to %s)", (startTime, endTime) => {
    expect(() => block({ startTime, endTime })).toThrow("must end after it starts");
  });

  describe("only when the venue is open (AC3a)", () => {
    it("accepts a block exactly filling one opening window", () => {
      expect(block({ startTime: "13:00", endTime: "18:00" }).slots).toHaveLength(20);
    });

    it("refuses a block starting before opening and names the closed time", () => {
      expect(() => block({ startTime: "06:45", endTime: "09:00" })).toThrow(UnavailabilityOutsideOpeningHoursError);
      expect(() => block({ startTime: "06:45", endTime: "09:00" })).toThrow("closed 06:45–07:00");
    });

    it("refuses a block ending after closing", () => {
      expect(() => block({ startTime: "17:00", endTime: "18:15" })).toThrow("closed 18:00–18:15");
    });

    it("refuses a block that spans a closed gap, naming the gap and the venue's hours", () => {
      const refusal = (() => {
        try {
          block({ startTime: "11:00", endTime: "14:00" });
        } catch (error) {
          return error as UnavailabilityOutsideOpeningHoursError;
        }
        throw new Error("expected a refusal");
      })();

      expect(refusal).toBeInstanceOf(UnavailabilityOutsideOpeningHoursError);
      expect(refusal.closed).toEqual(["12:00–13:00"]);
      expect(refusal.message).toBe(
        "The venue is closed 12:00–13:00, so it cannot be blocked then. " +
          "Choose times within its opening hours (07:00–12:00, 13:00–18:00, 19:00–24:00).",
      );
    });

    it("names every closed gap a block spans, earliest first", () => {
      expect(() => block({ startTime: "07:00", endTime: "24:00" })).toThrow("closed 12:00–13:00, 18:00–19:00");
    });

    it("accepts a block ending exactly where a closed gap starts, and one starting exactly where it ends", () => {
      expect(block({ startTime: "11:45", endTime: "12:00" }).slots).toEqual([{ date: "2026-10-12", slot: "47" }]);
      expect(block({ startTime: "13:00", endTime: "13:15" }).slots).toEqual([{ date: "2026-10-12", slot: "52" }]);
    });

    it("refuses any time at a venue open only 09:00-17:00, and accepts inside it", () => {
      const nineToFive: OpeningWindow[] = [{ start: "09:00", end: "17:00" }];

      expect(() => block({ startTime: "08:45", endTime: "09:15" }, nineToFive)).toThrow("closed 08:45–09:00");
      expect(block({ startTime: "09:00", endTime: "17:00" }, nineToFive).slots).toHaveLength(32);
    });

    it("refuses every time at a venue with no hours", () => {
      expect(() => block({}, [])).toThrow(UnavailabilityOutsideOpeningHoursError);
    });

    it("judges opening hours before the date: a closed-time block that has also ended names the closed time", () => {
      expect(() => block({ startDate: "2026-10-04", endDate: "2026-10-04", startTime: "06:00", endTime: "08:00" })).toThrow(
        UnavailabilityOutsideOpeningHoursError,
      );
    });
  });
});

describe("duplicatesInForceBlock (SPM-321)", () => {
  /** The stored form of a block, In force unless said otherwise. */
  function stored(
    overrides: Partial<NewVenueUnavailability> = {},
    status: VenueUnavailabilityEntry["status"] = "In force",
  ): VenueUnavailabilityEntry {
    return {
      ...block(overrides),
      id: "1",
      venueLocation: "Grand Hall",
      status,
      recordedByName: "Test Venue Staff",
      recordedAt: NOW.toISOString(),
      liftedByName: null,
      liftedAt: null,
    };
  }

  it("is true for the same venue, reason, days and times", () => {
    expect(duplicatesInForceBlock(block(), [stored()])).toBe(true);
  });

  it("is true whatever order the stored slots come in", () => {
    const reversed = { ...stored(), slots: [...stored().slots].reverse() };
    expect(duplicatesInForceBlock(block(), [reversed])).toBe(true);
  });

  it("is false when the reason differs, even over the same time", () => {
    expect(duplicatesInForceBlock(block({ reason: "Safety" }), [stored()])).toBe(false);
  });

  it.each([
    ["a different start time", { startTime: "09:15" }],
    ["a different end time", { endTime: "12:00" }],
    ["one more day", { endDate: "2026-10-13" }],
    ["another day", { startDate: "2026-10-14", endDate: "2026-10-14" }],
  ])("is false for %s: an overlapping block is allowed", (_label, change) => {
    expect(duplicatesInForceBlock(block(change), [stored()])).toBe(false);
  });

  it("is false at another venue", () => {
    expect(duplicatesInForceBlock(block({ venueId: venueId("venue-2") }), [stored()])).toBe(false);
  });

  it("is never true for Other, whatever the note: the note is free text nothing reads", () => {
    const other = stored({ reason: "Other", note: "Film shoot" });
    expect(duplicatesInForceBlock(block({ reason: "Other", note: "Film shoot" }), [other])).toBe(false);
    expect(duplicatesInForceBlock(block({ reason: "Other", note: "Fire drill" }), [other])).toBe(false);
    expect(duplicatesInForceBlock(block({ reason: "Other", note: null }), [stored({ reason: "Other", note: null })])).toBe(false);
  });

  it("still catches a duplicate of every other reason", () => {
    for (const reason of ["Maintenance", "Equipment failure", "Renovation", "Safety"]) {
      expect(duplicatesInForceBlock(block({ reason }), [stored({ reason })])).toBe(true);
    }
  });

  it("is false once the earlier block is lifted: it is history, and the time can be blocked again", () => {
    expect(duplicatesInForceBlock(block(), [stored({}, "Lifted")])).toBe(false);
  });

  it("is false when nothing is in force", () => {
    expect(duplicatesInForceBlock(block(), [])).toBe(false);
  });
});
