import { describe, expect, it } from "vitest";

import type { EventCoordinatorAssignedNotice } from "@/core/ports/outbound/notifier";

import { coordinatorAssignedMessage } from "./coordinator-assigned";

function notice(
  overrides: Partial<EventCoordinatorAssignedNotice> = {},
): EventCoordinatorAssignedNotice {
  return {
    recipientUserAccountId: "7",
    eventRequestId: "42",
    eventName: "Founders' Day",
    clientOrganisationName: "Acme Holdings",
    preferredDate: "2026-11-04",
    preferredSlots: ["AM", "PM"],
    ...overrides,
  };
}

describe("coordinatorAssignedMessage (SPM-57)", () => {
  it("AC2: names the event, its organisation, its date and the slots requested", () => {
    expect(coordinatorAssignedMessage(notice())).toEqual({
      subject: "Founders' Day has been assigned to you",
      body: "Founders' Day for Acme Holdings is now yours to review. Requested for Wed, 4 Nov 2026, AM, PM.",
    });
  });

  it("AC2: falls back to the preferred date alone when no slots were given", () => {
    const { body } = coordinatorAssignedMessage(notice({ preferredSlots: [] }));

    expect(body).toContain("Requested for Wed, 4 Nov 2026.");
  });

  it("AC2: says no date was requested when there is none", () => {
    const { body } = coordinatorAssignedMessage(
      notice({ preferredDate: null, preferredSlots: [] }),
    );

    expect(body).toContain("No date has been requested yet.");
  });

  it("leaves the organisation out when its name could not be read", () => {
    const { body } = coordinatorAssignedMessage(notice({ clientOrganisationName: null }));

    expect(body).toMatch(/^Founders' Day is now yours to review\./);
  });

  it("AC3: informs rather than asks the coordinator to accept or decline", () => {
    const { subject, body } = coordinatorAssignedMessage(notice());

    expect(`${subject} ${body}`).not.toMatch(/accept|decline|confirm|respond/i);
  });
});
