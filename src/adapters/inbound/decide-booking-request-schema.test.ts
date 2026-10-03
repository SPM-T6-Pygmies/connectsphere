import { describe, expect, it } from "vitest";

import { decideBookingRequestSchema } from "./decide-booking-request-schema";

describe("decideBookingRequestSchema (SPM-22)", () => {
  it("reads an approval, with the note and suggestion blank", () => {
    expect(
      decideBookingRequestSchema.parse({ bookingId: "7", decision: "approve", note: "", alternative: "" }),
    ).toEqual({ bookingId: "7", decision: "approve", note: "", alternative: null });
  });

  it("reads a rejection with a trimmed reason and a suggested venue", () => {
    expect(
      decideBookingRequestSchema.parse({
        bookingId: " 7 ",
        decision: "reject",
        note: "  Closed  ",
        alternative: "3",
      }),
    ).toEqual({ bookingId: "7", decision: "reject", note: "Closed", alternative: "3" });
  });

  it("refuses a missing booking or an unknown decision", () => {
    expect(
      decideBookingRequestSchema.safeParse({ bookingId: "", decision: "approve", note: "", alternative: "" })
        .success,
    ).toBe(false);
    expect(
      decideBookingRequestSchema.safeParse({ bookingId: "7", decision: "hold", note: "", alternative: "" })
        .success,
    ).toBe(false);
  });
});
