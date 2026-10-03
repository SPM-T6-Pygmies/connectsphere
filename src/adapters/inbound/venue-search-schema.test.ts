import { describe, expect, it } from "vitest";

import { venueSearchSchema } from "./venue-search-schema";

describe("venueSearchSchema (SPM-44)", () => {
  it("reads missing and blank filters as not applied", () => {
    const blank = {
      layout: null,
      attendance: null,
      facilities: [],
      accessibility: [],
      date: null,
      startTime: null,
      endTime: null,
    };

    expect(venueSearchSchema.parse({})).toEqual(blank);
    expect(
      venueSearchSchema.parse({ layout: " ", attendance: "", facilities: "" }),
    ).toEqual(blank);
  });

  it("reads a filled-in search", () => {
    expect(
      venueSearchSchema.parse({
        layout: "Theatre",
        attendance: "120",
        facilities: "Projector, Wi-Fi",
        accessibility: "Lift access",
        date: "2026-11-05",
        startTime: "09:00",
        endTime: "10:30",
      }),
    ).toEqual({
      layout: "Theatre",
      attendance: 120,
      facilities: ["Projector", "Wi-Fi"],
      accessibility: ["Lift access"],
      date: "2026-11-05",
      startTime: "09:00",
      endTime: "10:30",
    });
  });

  it("reads the start and end time, trimmed, and a blank one as not given", () => {
    expect(
      venueSearchSchema.parse({ startTime: " 09:15 ", endTime: "" }),
    ).toMatchObject({
      startTime: "09:15",
      endTime: null,
    });
  });

  it("takes the first of a repeated parameter", () => {
    expect(
      venueSearchSchema.parse({ layout: ["Theatre", "Banquet"] }).layout,
    ).toBe("Theatre");
  });

  it("refuses attendance that is not a whole number", () => {
    expect(venueSearchSchema.safeParse({ attendance: "ten" }).success).toBe(
      false,
    );
    expect(venueSearchSchema.safeParse({ attendance: "2.5" }).success).toBe(
      false,
    );
  });
});
