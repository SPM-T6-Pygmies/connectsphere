import { describe, expect, it } from "vitest";

import type { SafetyCheckRecordedNotice } from "@/core/ports/outbound/notifier";

import { safetyCheckRecordedMessage } from "./safety-check-recorded";

function notice(overrides: Partial<SafetyCheckRecordedNotice> = {}): SafetyCheckRecordedNotice {
  return {
    recipientUserAccountId: "2",
    eventId: "7",
    eventName: "Marina Bay Gala",
    outcome: "Rejected",
    comments: "Banquet layout holds 180; 220 expected. Switch to Theatre.",
    ...overrides,
  };
}

describe("safetyCheckRecordedMessage (SPM-263)", () => {
  it("AC1, AC2: names the event and the rejection, with the Officer's comments in full", () => {
    expect(safetyCheckRecordedMessage(notice())).toEqual({
      subject: "Marina Bay Gala failed its safety check",
      body: "The Safety Officer rejected Marina Bay Gala. Changes needed: Banquet layout holds 180; 220 expected. Switch to Theatre.",
    });
  });

  it("AC1, AC3: names the event and the approval, and says it can go on to confirmation", () => {
    expect(safetyCheckRecordedMessage(notice({ outcome: "Approved", comments: null }))).toEqual({
      subject: "Marina Bay Gala passed its safety check",
      body: "The Safety Officer approved Marina Bay Gala. It can go on to confirmation.",
    });
  });

  it("AC3: adds an approval's note when the Officer left one", () => {
    expect(
      safetyCheckRecordedMessage(notice({ outcome: "Approved", comments: "Keep the east exit clear." })).body,
    ).toBe("The Safety Officer approved Marina Bay Gala. It can go on to confirmation. Note: Keep the east exit clear.");
  });
});
