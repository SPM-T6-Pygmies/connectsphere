import { describe, expect, it } from "vitest";

import { coordinatorAssignedRow } from "./notification-row";

describe("coordinatorAssignedRow (SPM-177)", () => {
  it("records an in-app coordinator assignment as Pending against its recipient and request", () => {
    expect(
      coordinatorAssignedRow({
        recipientUserAccountId: "7",
        eventRequestId: "42",
        eventName: "Founders' Day",
        clientOrganisationName: "Acme Holdings",
        preferredDate: "2026-11-04",
        preferredStartTime: null,
        preferredEndTime: null,
      }),
    ).toEqual({
      recipient_user_account_id: "7",
      trigger_scenario: "coordinator-assigned",
      channel: "in_app",
      status: "Pending",
      related_event_request_id: "42",
      message_content:
        "Founders' Day has been assigned to you\nFounders' Day for Acme Holdings is now yours to review. Requested for Wed, 4 Nov 2026.",
    });
  });
});
