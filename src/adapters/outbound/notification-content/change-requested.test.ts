import { describe, expect, it } from "vitest";

import type { ChangeRequestedNotice } from "@/core/ports/outbound/notifier";

import { changeRequestedMessage } from "./change-requested";

function notice(overrides: Partial<ChangeRequestedNotice> = {}): ChangeRequestedNotice {
  return {
    recipientUserAccountId: "3",
    eventId: "7",
    changeRequestId: "41",
    eventName: "Marina Bay Gala",
    changes: [{ field: "expected_attendance", value: 320 }],
    ...overrides,
  };
}

describe("changeRequestedMessage (SPM-67)", () => {
  it("AC2: names the event and the one field asked for, with the value wanted", () => {
    expect(changeRequestedMessage(notice())).toEqual({
      subject: "Change requested for Marina Bay Gala",
      body: "The Organiser of Marina Bay Gala asks to change: Expected attendance → 320. Open the change request to accept or decline each change.",
    });
  });

  it("AC2: lists every field of a request covering several, in its order, with times in GMT+8", () => {
    const { body } = changeRequestedMessage(
      notice({
        changes: [
          {
            field: "times",
            value: [
              { date: "2026-11-26", start: "09:00", end: "12:00" },
              { date: "2026-11-27", start: "14:00", end: "17:00" },
            ],
          },
          { field: "venue_requirements", value: "Step-free access" },
          { field: "registration", value: { enabled: true, opensOn: "2026-11-01", closesOn: "2026-11-20" } },
        ],
      }),
    );

    expect(body).toBe(
      "The Organiser of Marina Bay Gala asks to change: Date and times → Thu, 26 Nov 2026 (09:00–12:00) and Fri, 27 Nov 2026 (14:00–17:00) (GMT+8); Venue requirements → Step-free access; Registration → Open 2026-11-01 to 2026-11-20. Open the change request to accept or decline each change.",
    );
  });

  it("AC2: reads a Not applicable field as Not applicable", () => {
    const { body } = changeRequestedMessage(
      notice({
        changes: [
          { field: "registration", value: null },
          { field: "equipment_requirements", value: null },
        ],
      }),
    );

    expect(body).toContain("Registration → Not applicable; Equipment requirements → Not applicable.");
  });
});
