import { describe, expect, it } from "vitest";

import { submitVenueBookingRequestSchema } from "./submit-venue-booking-request-schema";

const VALID = {
  eventId: "7",
  eventRequestId: "3",
  venueId: "2",
  roomLayout: "5",
  slots: ["2026-10-05|09:00|11:30", "2026-10-05|19:00|21:00"],
};

describe("submitVenueBookingRequestSchema (SPM-46)", () => {
  it("reads each time as a date, a start and an end", () => {
    expect(submitVenueBookingRequestSchema.parse(VALID)).toEqual({
      ...VALID,
      slots: [
        { date: "2026-10-05", start: "09:00", end: "11:30" },
        { date: "2026-10-05", start: "19:00", end: "21:00" },
      ],
    });
  });

  it("reads a blank layout as no layout chosen", () => {
    expect(
      submitVenueBookingRequestSchema.parse({ ...VALID, roomLayout: "" })
        .roomLayout,
    ).toBeNull();
  });

  it("leaves an empty slot list for the domain to refuse", () => {
    expect(
      submitVenueBookingRequestSchema.parse({ ...VALID, slots: [] }).slots,
    ).toEqual([]);
  });

  it.each([
    "2026-10-05|Evening",
    "2026-10-05",
    "|09:00|10:00",
    "2026-10-05|09:00",
    "2026-10-05|AM|PM",
  ])("refuses the malformed time %j", (slot) => {
    expect(
      submitVenueBookingRequestSchema.safeParse({ ...VALID, slots: [slot] })
        .success,
    ).toBe(false);
  });

  it("refuses a request with no venue chosen", () => {
    expect(
      submitVenueBookingRequestSchema.safeParse({ ...VALID, venueId: " " })
        .success,
    ).toBe(false);
  });
});
