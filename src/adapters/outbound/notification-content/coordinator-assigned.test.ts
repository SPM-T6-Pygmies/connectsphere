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
    preferredStartTime: "2026-11-04T01:00:00+00:00",
    preferredEndTime: "2026-11-04T09:00:00+00:00",
    ...overrides,
  };
}

describe("coordinatorAssignedMessage (SPM-57)", () => {
  it("AC2: names the event, its organisation and its time on one day, in Singapore time", () => {
    expect(coordinatorAssignedMessage(notice())).toEqual({
      subject: "Founders' Day has been assigned to you",
      body: "Founders' Day for Acme Holdings is now yours to review. Requested for Wed, 4 Nov 2026, 9:00 am – 5:00 pm.",
    });
  });

  it("AC2: gives both dates when the requested time spans more than one day", () => {
    const { body } = coordinatorAssignedMessage(
      notice({ preferredEndTime: "2026-11-06T09:00:00+00:00" }),
    );

    expect(body).toContain("Requested for Wed, 4 Nov 2026, 9:00 am – Fri, 6 Nov 2026, 5:00 pm.");
  });

  it("AC2: falls back to the preferred date alone when no times were given", () => {
    const { body } = coordinatorAssignedMessage(
      notice({ preferredStartTime: null, preferredEndTime: null }),
    );

    expect(body).toContain("Requested for Wed, 4 Nov 2026.");
  });

  it("AC2: says no date was requested when there is none", () => {
    const { body } = coordinatorAssignedMessage(
      notice({ preferredDate: null, preferredStartTime: null, preferredEndTime: null }),
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
