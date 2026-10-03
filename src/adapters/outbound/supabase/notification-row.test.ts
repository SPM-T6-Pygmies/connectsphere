import { describe, expect, it } from "vitest";

import {
  clarificationRequestedRow,
  coordinatorAssignedRow,
  organiserCoordinatorAssignedRow,
} from "./notification-row";

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

describe("organiserCoordinatorAssignedRow (SPM-58)", () => {
  it("records the organiser's notice as Pending against the organiser and the request", () => {
    expect(
      organiserCoordinatorAssignedRow({
        recipientUserAccountId: "3",
        eventRequestId: "42",
        eventName: "Founders' Day",
        coordinatorName: "Arjun Nair",
      }),
    ).toEqual({
      recipient_user_account_id: "3",
      trigger_scenario: "organiser-coordinator-assigned",
      channel: "in_app",
      status: "Pending",
      related_event_request_id: "42",
      message_content:
        "Arjun Nair is coordinating Founders' Day\nArjun Nair is now your point of contact at ConnectSphere for Founders' Day.",
    });
  });
});

describe("clarificationRequestedRow (SPM-59)", () => {
  it("records the clarification notice as Pending against the organiser and the request", () => {
    expect(
      clarificationRequestedRow({
        recipientUserAccountId: "3",
        eventRequestId: "42",
        eventName: "Founders' Day",
        message: "Which rooms?",
      }),
    ).toMatchObject({
      recipient_user_account_id: "3",
      trigger_scenario: "clarification-requested",
      status: "Pending",
      related_event_request_id: "42",
    });
  });
});
