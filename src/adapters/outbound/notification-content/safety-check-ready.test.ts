import { describe, expect, it } from "vitest";

import type { SafetyCheckReadyNotice } from "@/core/ports/outbound/notifier";

import { safetyCheckReadyMessage } from "./safety-check-ready";

function notice(overrides: Partial<SafetyCheckReadyNotice> = {}): SafetyCheckReadyNotice {
  return {
    recipientUserAccountId: "11",
    eventId: "7",
    eventName: "Harbour Lights Gala",
    preferredDate: "2026-11-20",
    venues: ["Grand Ballroom"],
    equipmentLines: 1,
    ...overrides,
  };
}

describe("safetyCheckReadyMessage (SPM-262)", () => {
  it("AC5: names the event, its confirmed venue, its equipment and its date", () => {
    expect(safetyCheckReadyMessage(notice())).toEqual({
      subject: "Harbour Lights Gala is ready for a safety check",
      body: "Confirmed at Grand Ballroom. All equipment reserved. Event date: Fri, 20 Nov 2026.",
    });
  });

  it("AC5: names every confirmed venue", () => {
    expect(safetyCheckReadyMessage(notice({ venues: ["Grand Ballroom", "Sky Terrace"] })).body).toBe(
      "Confirmed at Grand Ballroom and Sky Terrace. All equipment reserved. Event date: Fri, 20 Nov 2026.",
    );
  });

  it("AC5: says no equipment is needed when the event has none", () => {
    expect(safetyCheckReadyMessage(notice({ equipmentLines: 0 })).body).toBe(
      "Confirmed at Grand Ballroom. No equipment needed. Event date: Fri, 20 Nov 2026.",
    );
  });

  it("AC5: says so when the event has no date yet", () => {
    expect(safetyCheckReadyMessage(notice({ preferredDate: null })).body).toBe(
      "Confirmed at Grand Ballroom. All equipment reserved. No event date set yet.",
    );
  });
});
