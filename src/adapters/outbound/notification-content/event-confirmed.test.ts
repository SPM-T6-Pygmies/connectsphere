import { describe, expect, it } from "vitest";

import type { EventConfirmedNotice } from "@/core/ports/outbound/notifier";

import { eventConfirmedMessage } from "./event-confirmed";

function notice(overrides: Partial<EventConfirmedNotice> = {}): EventConfirmedNotice {
  return {
    recipientUserAccountId: "3",
    eventId: "7",
    eventRequestId: "12",
    eventName: "Marina Bay Gala",
    times: [{ date: "2026-11-20", start: "09:00", end: "12:00" }],
    venueLocation: "Main Hall",
    equipment: [
      { equipmentType: "Wireless microphone", quantityReserved: 4 },
      { equipmentType: "Projector", quantityReserved: 1 },
    ],
    ...overrides,
  };
}

describe("eventConfirmedMessage (SPM-66)", () => {
  it("AC2: says the event is Confirmed and ConnectSphere is committed, then lists its arrangements", () => {
    expect(eventConfirmedMessage(notice())).toEqual({
      subject: "Marina Bay Gala is confirmed",
      body: "Marina Bay Gala is now Confirmed: ConnectSphere is committed to delivering it. When: Fri, 20 Nov 2026 (09:00–12:00). Venue: Main Hall. Equipment: 4 × Wireless microphone, 1 × Projector.",
    });
  });

  it("leaves out arrangements that are Not applicable to the event", () => {
    expect(eventConfirmedMessage(notice({ times: [], venueLocation: null, equipment: [] })).body).toBe(
      "Marina Bay Gala is now Confirmed: ConnectSphere is committed to delivering it.",
    );
  });
});
