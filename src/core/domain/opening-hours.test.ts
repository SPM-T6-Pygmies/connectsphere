import { describe, expect, it } from "vitest";

import { InvalidVenueError } from "./errors";
import {
  closedPeriods,
  defineOpeningHours,
  formatOpeningHours,
  type OpeningWindow,
} from "./opening-hours";

/** The reason `defineOpeningHours` gives for refusing `windows`. */
function refusal(windows: readonly OpeningWindow[]): string {
  try {
    defineOpeningHours(windows);
  } catch (error) {
    if (error instanceof InvalidVenueError) {
      expect(error.field).toBe("openingHours");
      return error.message;
    }
    throw error;
  }
  throw new Error("expected defineOpeningHours to refuse");
}

describe("defineOpeningHours (SPM-332)", () => {
  it("accepts one window", () => {
    expect(defineOpeningHours([{ start: "07:00", end: "12:00" }])).toEqual([
      { start: "07:00", end: "12:00" },
    ]);
  });

  it("refuses no hours at all", () => {
    expect(refusal([])).toBe("Set the venue's opening and closing time.");
  });

  describe("a window ends after it starts", () => {
    it("refuses a window that ends as it starts", () => {
      expect(refusal([{ start: "07:00", end: "07:00" }])).toBe(
        "The window 07:00–07:00 must end after it starts.",
      );
    });

    it("refuses a window that ends before it starts", () => {
      expect(refusal([{ start: "12:00", end: "07:00" }])).toMatch(/12:00–07:00 must end after/);
    });

    it("accepts the shortest window, 15 minutes", () => {
      expect(defineOpeningHours([{ start: "07:00", end: "07:15" }])).toHaveLength(1);
    });
  });

  describe("24:00 is a valid end", () => {
    it("accepts 23:45–24:00", () => {
      expect(defineOpeningHours([{ start: "23:45", end: "24:00" }])).toHaveLength(1);
    });

    it("accepts the whole day, 00:00–24:00", () => {
      expect(defineOpeningHours([{ start: "00:00", end: "24:00" }])).toHaveLength(1);
    });

    it("refuses an end past 24:00", () => {
      expect(refusal([{ start: "23:00", end: "24:15" }])).toMatch(/24:15 is not a time/);
    });

    it("refuses a start at 24:00", () => {
      expect(refusal([{ start: "24:00", end: "24:00" }])).toBe(
        "An opening window cannot start at 24:00.",
      );
    });
  });

  describe("times are on the 15-minute grid", () => {
    it("refuses a start off the grid, naming it", () => {
      expect(refusal([{ start: "07:10", end: "12:00" }])).toMatch(/07:10 is not on the 15-minute grid/);
    });

    it("refuses an end off the grid", () => {
      expect(refusal([{ start: "07:00", end: "11:59" }])).toMatch(/11:59 is not on the 15-minute grid/);
    });

    it("refuses a blank time", () => {
      expect(refusal([{ start: "", end: "12:00" }])).toMatch(/is not a time/);
    });
  });

  describe("opening hours are one continuous block", () => {
    it.each([
      ["a gap between them", [{ start: "07:00", end: "12:00" }, { start: "13:00", end: "18:00" }]],
      ["touching end-to-start", [{ start: "07:00", end: "12:00" }, { start: "12:00", end: "13:00" }]],
      ["overlapping", [{ start: "07:00", end: "12:00" }, { start: "11:45", end: "13:00" }]],
    ])("refuses two windows, %s", (_case, windows) => {
      expect(refusal(windows)).toBe(
        "A venue opens once a day: set one opening time and one closing time.",
      );
    });
  });
});

describe("closedPeriods (SPM-334)", () => {
  const amAndNight = [
    { start: "07:00", end: "12:00" },
    { start: "19:00", end: "24:00" },
  ];

  it("finds nothing closed inside an open window", () => {
    expect(closedPeriods(amAndNight, { start: 420, end: 720 })).toEqual([]);
  });

  it("finds the gap a range spans between two windows", () => {
    expect(closedPeriods(amAndNight, { start: 660, end: 1200 })).toEqual([
      { start: 720, end: 1140 },
    ]);
  });
});

describe("formatOpeningHours (SPM-335)", () => {
  it("writes each window as times, with no slot labels", () => {
    expect(
      formatOpeningHours([
        { start: "07:00", end: "12:00" },
        { start: "19:00", end: "24:00" },
      ]),
    ).toBe("07:00–12:00, 19:00–24:00");
  });
});
