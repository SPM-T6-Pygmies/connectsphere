import { describe, expect, it } from "vitest";

import { cancelVenueBookingSchema } from "./cancel-venue-booking-schema";

const valid = { eventId: "7", eventRequestId: "24", bookingId: "12" };

describe("cancelVenueBookingSchema (SPM-20)", () => {
  it("reads the event and the booking", () => {
    expect(cancelVenueBookingSchema.parse(valid)).toEqual(valid);
  });

  it.each(["eventId", "eventRequestId", "bookingId"] as const)("refuses a missing %s", (field) => {
    expect(cancelVenueBookingSchema.safeParse({ ...valid, [field]: " " }).success).toBe(false);
  });
});
