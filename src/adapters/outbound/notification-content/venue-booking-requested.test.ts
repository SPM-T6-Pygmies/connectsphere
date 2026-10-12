import { describe, expect, it } from "vitest";

import type { VenueBookingRequestedNotice } from "@/core/ports/outbound/notifier";

import { venueBookingRequestedMessage } from "./venue-booking-requested";

function notice(overrides: Partial<VenueBookingRequestedNotice> = {}): VenueBookingRequestedNotice {
  return {
    recipientUserAccountId: "5",
    bookingId: "31",
    eventName: "Harbour Lights Gala",
    venueLocation: "Grand Ballroom",
    slots: [{ date: "2026-11-20", slot: "PM" }],
    ...overrides,
  };
}

describe("venueBookingRequestedMessage (SPM-61)", () => {
  it("AC2: names the venue, the date and the slot requested", () => {
    expect(venueBookingRequestedMessage(notice())).toEqual({
      subject: "Grand Ballroom requested for Harbour Lights Gala",
      body: "Requested for Fri, 20 Nov 2026 (PM). Approve or reject it.",
    });
  });

  it("AC2: lists every slot on a day, in the order they fall", () => {
    const message = venueBookingRequestedMessage(
      notice({
        slots: [
          { date: "2026-11-20", slot: "AM" },
          { date: "2026-11-20", slot: "PM" },
          { date: "2026-11-20", slot: "Night" },
        ],
      }),
    );

    expect(message.body).toBe("Requested for Fri, 20 Nov 2026 (AM, PM, Night). Approve or reject it.");
  });

  it("AC2: names every date of a request that spans days, each with its own slots", () => {
    const message = venueBookingRequestedMessage(
      notice({
        slots: [
          { date: "2026-11-20", slot: "Night" },
          { date: "2026-11-21", slot: "AM" },
          { date: "2026-11-21", slot: "PM" },
        ],
      }),
    );

    expect(message.body).toBe(
      "Requested for Fri, 20 Nov 2026 (Night) and Sat, 21 Nov 2026 (AM, PM). Approve or reject it.",
    );
  });
});
