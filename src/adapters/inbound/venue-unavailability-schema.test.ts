import { describe, expect, it } from "vitest";

import {
  liftVenueUnavailabilitySchema,
  recordVenueUnavailabilitySchema,
} from "./venue-unavailability-schema";

const VALID = {
  venueId: "2",
  startDate: "2026-10-12",
  endDate: "2026-10-16",
  slots: "AM, PM",
  reason: "Renovation",
  note: "",
};

describe("recordVenueUnavailabilitySchema (SPM-269)", () => {
  it("AC1: turns the posted text into the use case input", () => {
    expect(recordVenueUnavailabilitySchema.parse(VALID)).toEqual({
      venueId: "2",
      startDate: "2026-10-12",
      endDate: "2026-10-16",
      slots: ["AM", "PM"],
      reason: "Renovation",
      note: null,
    });
  });

  it("AC2: rejects a missing venue", () => {
    const result = recordVenueUnavailabilitySchema.safeParse({ ...VALID, venueId: "  " });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Choose a venue.");
  });

  it.each(["", "banana", "12/10/2026", "2026-10"])("AC4: rejects the date %j, which is not a date", (value) => {
    expect(recordVenueUnavailabilitySchema.safeParse({ ...VALID, startDate: value }).success).toBe(false);
    expect(recordVenueUnavailabilitySchema.safeParse({ ...VALID, endDate: value }).success).toBe(false);
  });

  it("AC4: leaves a start after the end, and a day that does not exist, for the domain to refuse", () => {
    expect(
      recordVenueUnavailabilitySchema.safeParse({ ...VALID, startDate: "2026-10-16", endDate: "2026-10-12" }).success,
    ).toBe(true);
    expect(recordVenueUnavailabilitySchema.safeParse({ ...VALID, startDate: "2026-02-30" }).success).toBe(true);
  });

  it.each(["Evening", "AM, Dusk", "am"])("AC3: rejects the slots %j, which are not AM, PM or Night", (slots) => {
    expect(recordVenueUnavailabilitySchema.safeParse({ ...VALID, slots }).success).toBe(false);
  });

  it("AC3: leaves no slots ticked for the domain to refuse", () => {
    expect(recordVenueUnavailabilitySchema.parse({ ...VALID, slots: "" }).slots).toEqual([]);
  });

  it("AC7: reads a blank note as no note and passes any other text on", () => {
    expect(recordVenueUnavailabilitySchema.parse({ ...VALID, note: "   " }).note).toBeNull();
    expect(recordVenueUnavailabilitySchema.parse({ ...VALID, reason: "Other", note: " Pipe burst " }).note).toBe(
      "Pipe burst",
    );
  });

  it("AC6: leaves an unrecognised reason for the domain to refuse", () => {
    expect(recordVenueUnavailabilitySchema.parse({ ...VALID, reason: "Holiday" }).reason).toBe("Holiday");
  });
});

describe("liftVenueUnavailabilitySchema (SPM-269)", () => {
  it("AC15: reads the block to lift", () => {
    expect(liftVenueUnavailabilitySchema.parse({ unavailabilityId: " 12 " })).toEqual({ unavailabilityId: "12" });
  });

  it("AC15: rejects a missing block", () => {
    expect(liftVenueUnavailabilitySchema.safeParse({ unavailabilityId: "" }).success).toBe(false);
  });
});
