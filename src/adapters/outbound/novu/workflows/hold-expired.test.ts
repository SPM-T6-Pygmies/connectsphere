import { describe, expect, it } from "vitest";

import type { HoldExpiredNotice } from "@/core/ports/outbound/notifier";

import { holdExpired, holdExpiredInApp } from "./hold-expired";

function notice(overrides: Partial<HoldExpiredNotice> = {}): HoldExpiredNotice {
  return {
    recipientUserAccountId: "3",
    bookingId: "31",
    eventId: "8",
    eventRequestId: "6",
    eventName: "Harbour Lights Gala",
    venueLocation: "Grand Ballroom",
    times: [{ date: "2026-11-20", start: "13:00", end: "18:00" }],
    holdExpiresAt: "2026-11-18T05:00:00.000Z",
    ...overrides,
  };
}

describe("holdExpiredInApp (SPM-254)", () => {
  it("opens the booking on its event's Request a venue page, in the same tab", () => {
    expect(holdExpiredInApp(notice()).redirect).toEqual({
      url: "/staff/coordinator/6/venue-booking?booking=31",
      target: "_self",
    });
  });

  it("opens the event itself when it has no request to book venues from", () => {
    expect(holdExpiredInApp(notice({ eventRequestId: null })).redirect.url).toBe(
      "/staff/coordinator/events/8",
    );
  });
});

describe("holdExpired (SPM-254)", () => {
  it("cannot be switched off, so a coordinator always learns the venue is no longer held", async () => {
    const definition = await holdExpired.discover();

    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });

  it("is named for people in the preferences sheet, not by its id", async () => {
    const definition = await holdExpired.discover();

    expect(definition.name).toBe("Hold expired");
  });
});
