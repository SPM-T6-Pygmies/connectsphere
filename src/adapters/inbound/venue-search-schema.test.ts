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
      slots: [],
    };

    expect(venueSearchSchema.parse({})).toEqual(blank);
    expect(venueSearchSchema.parse({ layout: " ", attendance: "", facilities: "" })).toEqual(blank);
  });

  it("reads a filled-in search", () => {
    expect(
      venueSearchSchema.parse({
        layout: "Theatre",
        attendance: "120",
        facilities: "Projector, Wi-Fi",
        accessibility: "Lift access",
        date: "2026-11-05",
        slots: ["AM", "Night"],
      }),
    ).toEqual({
      layout: "Theatre",
      attendance: 120,
      facilities: ["Projector", "Wi-Fi"],
      accessibility: ["Lift access"],
      date: "2026-11-05",
      slots: ["AM", "Night"],
    });
  });

  it("reads one slot, many slots, and blank ones", () => {
    expect(venueSearchSchema.parse({ slots: "PM" }).slots).toEqual(["PM"]);
    expect(venueSearchSchema.parse({ slots: ["Night", "AM"] }).slots).toEqual(["Night", "AM"]);
    expect(venueSearchSchema.parse({ slots: ["", " PM "] }).slots).toEqual(["PM"]);
  });

  it("takes the first of a repeated parameter", () => {
    expect(venueSearchSchema.parse({ layout: ["Theatre", "Banquet"] }).layout).toBe("Theatre");
  });

  it("refuses attendance that is not a whole number", () => {
    expect(venueSearchSchema.safeParse({ attendance: "ten" }).success).toBe(false);
    expect(venueSearchSchema.safeParse({ attendance: "2.5" }).success).toBe(false);
  });
});
