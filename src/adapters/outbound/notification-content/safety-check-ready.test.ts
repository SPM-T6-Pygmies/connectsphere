import { describe, expect, it } from "vitest";

import type { SafetyCheckReadyNotice } from "@/core/ports/outbound/notifier";

import { safetyCheckReadyMessage } from "./safety-check-ready";

function notice(overrides: Partial<SafetyCheckReadyNotice> = {}): SafetyCheckReadyNotice {
  return {
    recipientUserAccountId: "11",
    eventId: "7",
    eventName: "Harbour Lights Gala",
    preferredDate: "2026-11-20",
    ...overrides,
  };
}

describe("safetyCheckReadyMessage (SPM-262)", () => {
  it("AC5: names the event and its date", () => {
    expect(safetyCheckReadyMessage(notice())).toEqual({
      subject: "Harbour Lights Gala is ready for a safety check",
      body: "Its venue bookings are confirmed and its equipment is reserved. Event date: Fri, 20 Nov 2026.",
    });
  });

  it("AC5: says so when the event has no date yet", () => {
    expect(safetyCheckReadyMessage(notice({ preferredDate: null })).body).toBe(
      "Its venue bookings are confirmed and its equipment is reserved. No event date set yet.",
    );
  });
});
