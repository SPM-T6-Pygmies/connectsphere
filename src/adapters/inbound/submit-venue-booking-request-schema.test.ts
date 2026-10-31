import { describe, expect, it } from "vitest";

import { submitVenueBookingRequestSchema } from "./submit-venue-booking-request-schema";

const VALID = {
  eventId: "7",
  venueId: "2",
  roomLayout: "5",
  times: [
    { date: "2026-10-05", start: "07:00", end: "12:00" },
    { date: "2026-10-06", start: "23:45", end: "24:00" },
  ],
};

describe("submitVenueBookingRequestSchema (SPM-46)", () => {
  it("reads a blank layout as no layout chosen", () => {
    expect(submitVenueBookingRequestSchema.parse({ ...VALID, roomLayout: "" }).roomLayout).toBeNull();
  });

  it("refuses a request with no venue chosen", () => {
    expect(submitVenueBookingRequestSchema.safeParse({ ...VALID, venueId: " " }).success).toBe(false);
  });
});

describe("submitVenueBookingRequestSchema (SPM-348)", () => {
  it("reads each date with its start and end time, in the order sent", () => {
    expect(submitVenueBookingRequestSchema.parse(VALID).times).toEqual(VALID.times);
  });

  it("passes a blank date or time through, so the domain can name what is missing", () => {
    const times = [{ date: "", start: "07:00", end: "" }];
    expect(submitVenueBookingRequestSchema.parse({ ...VALID, times }).times).toEqual(times);
  });

  it("leaves an empty list for the domain to refuse", () => {
    expect(submitVenueBookingRequestSchema.parse({ ...VALID, times: [] }).times).toEqual([]);
  });
});

describe("submitVenueBookingRequestSchema (SPM-251)", () => {
  it("AC1: reads the flagged booking a re-request replaces", () => {
    expect(submitVenueBookingRequestSchema.parse({ ...VALID, replacesBookingId: " 12 " }).replacesBookingId).toBe("12");
  });

  it("AC4: reads a blank or missing one as an ordinary request", () => {
    expect(submitVenueBookingRequestSchema.parse({ ...VALID, replacesBookingId: " " }).replacesBookingId).toBeNull();
    expect(submitVenueBookingRequestSchema.parse(VALID).replacesBookingId).toBeNull();
  });
});
