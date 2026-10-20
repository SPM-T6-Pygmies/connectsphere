import { describe, expect, it } from "vitest";

import type { VenueBookingCancelledNotice } from "@/core/ports/outbound/notifier";

import { venueBookingCancelledMessage } from "./venue-booking-cancelled";

function notice(overrides: Partial<VenueBookingCancelledNotice> = {}): VenueBookingCancelledNotice {
  return {
    recipientUserAccountId: "5",
    bookingId: "31",
    venueId: "2",
    venueLocation: "Grand Ballroom",
    eventName: "Harbour Lights Gala",
    slots: [{ date: "2026-11-20", slot: "PM" }],
    ...overrides,
  };
}

describe("venueBookingCancelledMessage (SPM-63)", () => {
  it("AC3: names the venue, the date and the time released, and that the booking is Released", () => {
    expect(venueBookingCancelledMessage(notice())).toEqual({
      subject: "Grand Ballroom booking cancelled for Harbour Lights Gala",
      body: "The coordinator cancelled the confirmed booking of Grand Ballroom for Fri, 20 Nov 2026 (13:00–18:00). It is now Released, and that time is free to book again.",
    });
  });

  it("AC3: names every date released, each with its own times, in the order they fall", () => {
    const message = venueBookingCancelledMessage(
      notice({
        slots: [
          { date: "2026-11-20", slot: "AM" },
          { date: "2026-11-20", slot: "Night" },
          { date: "2026-11-21", slot: "PM" },
        ],
      }),
    );

    expect(message.body).toContain(
      "for Fri, 20 Nov 2026 (07:00–12:00, 19:00–24:00) and Sat, 21 Nov 2026 (13:00–18:00).",
    );
  });

  it("AC3: gives times, never the AM, PM or Night slot names", () => {
    const { subject, body } = venueBookingCancelledMessage(
      notice({ slots: [{ date: "2026-11-20", slot: "AM" }, { date: "2026-11-20", slot: "Night" }] }),
    );

    expect(`${subject} ${body}`).not.toMatch(/\b(AM|PM|Night)\b/);
  });
});
