import { describe, expect, it } from "vitest";

import type { VenueBookingRequestedNotice } from "@/core/ports/outbound/notifier";

import { venueBookingRequestedMessage } from "./venue-booking-requested";

function notice(overrides: Partial<VenueBookingRequestedNotice> = {}): VenueBookingRequestedNotice {
  return {
    recipientUserAccountId: "5",
    bookingId: "31",
    eventName: "Harbour Lights Gala",
    venueLocation: "Grand Ballroom",
    times: [{ date: "2026-11-20", start: "13:00", end: "18:00" }],
    ...overrides,
  };
}

describe("venueBookingRequestedMessage (SPM-61)", () => {
  it("AC2: names the venue, the date and the slot requested", () => {
    expect(venueBookingRequestedMessage(notice())).toEqual({
      subject: "Grand Ballroom requested for Harbour Lights Gala",
      body: "Requested for Fri, 20 Nov 2026 (13:00–18:00). Approve or reject it.",
    });
  });

  it("AC2: lists every slot on a day, in the order they fall", () => {
    const message = venueBookingRequestedMessage(
      notice({
        times: [
          { date: "2026-11-20", start: "07:00", end: "12:00" },
          { date: "2026-11-20", start: "13:00", end: "18:00" },
          { date: "2026-11-20", start: "19:00", end: "24:00" },
        ],
      }),
    );

    expect(message.body).toBe("Requested for Fri, 20 Nov 2026 (07:00–12:00, 13:00–18:00, 19:00–24:00). Approve or reject it.");
  });

  it("AC2: names every date of a request that spans days, each with its own slots", () => {
    const message = venueBookingRequestedMessage(
      notice({
        times: [
          { date: "2026-11-20", start: "19:00", end: "24:00" },
          { date: "2026-11-21", start: "07:00", end: "12:00" },
          { date: "2026-11-21", start: "13:00", end: "18:00" },
        ],
      }),
    );

    expect(message.body).toBe(
      "Requested for Fri, 20 Nov 2026 (19:00–24:00) and Sat, 21 Nov 2026 (07:00–12:00, 13:00–18:00). Approve or reject it.",
    );
  });
});
