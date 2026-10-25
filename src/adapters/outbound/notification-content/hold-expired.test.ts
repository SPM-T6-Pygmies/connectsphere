import { describe, expect, it } from "vitest";

import type { HoldExpiredNotice } from "@/core/ports/outbound/notifier";

import { holdExpiredMessage } from "./hold-expired";

function notice(overrides: Partial<HoldExpiredNotice> = {}): HoldExpiredNotice {
  return {
    recipientUserAccountId: "3",
    bookingId: "31",
    eventId: "8",
    eventRequestId: "6",
    eventName: "Harbour Lights Gala",
    venueLocation: "Grand Ballroom",
    times: [
      { date: "2026-11-20", start: "07:00", end: "12:00" },
      { date: "2026-11-20", start: "13:00", end: "18:00" },
    ],
    holdExpiresAt: "2026-11-18T05:00:00.000Z",
    ...overrides,
  };
}

describe("holdExpiredMessage (SPM-254)", () => {
  it("AC1, AC2: names the venue, the held slots and the expiry, and says the venue is no longer held", () => {
    expect(holdExpiredMessage(notice())).toEqual({
      subject: "Grand Ballroom hold expired for Harbour Lights Gala",
      body: "The hold on Grand Ballroom for Fri, 20 Nov 2026 (07:00–12:00, 13:00–18:00) expired at Wed, 18 Nov, 1:00 pm without being confirmed. The venue is no longer held; send a new request if you still need it.",
    });
  });

  it("AC2: gives the expiry in Singapore time, across midnight UTC", () => {
    expect(holdExpiredMessage(notice({ holdExpiresAt: "2026-11-18T23:00:00.000Z" })).body).toContain(
      "expired at Thu, 19 Nov, 7:00 am",
    );
  });
});
