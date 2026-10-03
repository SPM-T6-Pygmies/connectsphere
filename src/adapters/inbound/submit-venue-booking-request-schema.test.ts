import { describe, expect, it } from "vitest";

import { submitVenueBookingRequestSchema } from "./submit-venue-booking-request-schema";

const VALID = {
  eventId: "7",
  eventRequestId: "3",
  venueId: "2",
  roomLayout: "5",
  slots: ["2026-10-05|AM", "2026-10-05|Night"],
};

describe("submitVenueBookingRequestSchema (SPM-46)", () => {
  it("reads each slot as a date and a slot", () => {
    expect(submitVenueBookingRequestSchema.parse(VALID)).toEqual({
      ...VALID,
      slots: [
        { date: "2026-10-05", slot: "AM" },
        { date: "2026-10-05", slot: "Night" },
      ],
    });
  });

  it("reads a blank layout as no layout chosen", () => {
    expect(submitVenueBookingRequestSchema.parse({ ...VALID, roomLayout: "" }).roomLayout).toBeNull();
  });

  it("leaves an empty slot list for the domain to refuse", () => {
    expect(submitVenueBookingRequestSchema.parse({ ...VALID, slots: [] }).slots).toEqual([]);
  });

  it.each(["2026-10-05|Evening", "2026-10-05", "|AM"])("refuses the malformed slot %j", (slot) => {
    expect(submitVenueBookingRequestSchema.safeParse({ ...VALID, slots: [slot] }).success).toBe(false);
  });

  it("refuses a request with no venue chosen", () => {
    expect(submitVenueBookingRequestSchema.safeParse({ ...VALID, venueId: " " }).success).toBe(false);
  });
});
