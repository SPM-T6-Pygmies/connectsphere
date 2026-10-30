import { describe, expect, it } from "vitest";

import type { ChangeRequestDecidedNotice } from "@/core/ports/outbound/notifier";

import { changeRequestDecidedMessage } from "./change-request-decided";

function notice(overrides: Partial<ChangeRequestDecidedNotice> = {}): ChangeRequestDecidedNotice {
  return {
    recipientUserAccountId: "6",
    eventId: "7",
    changeRequestId: "41",
    eventRequestId: "12",
    eventName: "Marina Bay Gala",
    accepted: [],
    declined: [],
    ...overrides,
  };
}

describe("changeRequestDecidedMessage (SPM-110)", () => {
  it("AC1, AC2: lists every accepted field with its new value", () => {
    expect(
      changeRequestDecidedMessage(
        notice({
          accepted: [
            { field: "expected_attendance", value: 320 },
            { field: "registration", value: null },
          ],
        }),
      ),
    ).toEqual({
      subject: "Your change request for Marina Bay Gala is decided",
      body: "Accepted: Expected attendance → 320; Registration → Not applicable.",
    });
  });

  it("AC2, AC3: lists every declined field with its reason", () => {
    const { body } = changeRequestDecidedMessage(
      notice({
        declined: [
          {
            change: { field: "times", value: [{ date: "2026-12-03", start: "10:00", end: "15:00" }] },
            reason: "The hall is booked that week",
          },
        ],
      }),
    );

    expect(body).toBe(
      "Declined: Date and times → Thu, 3 Dec 2026 (10:00–15:00) (GMT+8) (The hall is booked that week).",
    );
  });

  it("AC4: covers a partly accepted request in one message, accepted lines first", () => {
    const { body } = changeRequestDecidedMessage(
      notice({
        accepted: [{ field: "expected_attendance", value: 320 }],
        declined: [{ change: { field: "venue_requirements", value: "Step-free access" }, reason: "No such venue free" }],
      }),
    );

    expect(body).toBe(
      "Accepted: Expected attendance → 320. Declined: Venue requirements → Step-free access (No such venue free).",
    );
  });
});
