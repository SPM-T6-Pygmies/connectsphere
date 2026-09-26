import { describe, expect, it } from "vitest";

import { coordinatorAssignedInApp } from "./coordinator-assigned";

describe("coordinatorAssignedInApp (SPM-173)", () => {
  it("AC5: opens the assigned request in the coordinator workspace, in the same tab", () => {
    const inApp = coordinatorAssignedInApp({
      recipientUserAccountId: "7",
      eventRequestId: "42",
      eventName: "Founders' Day",
      clientOrganisationName: "Acme Holdings",
      preferredDate: "2026-11-04",
      preferredStartTime: null,
      preferredEndTime: null,
    });

    expect(inApp).toEqual({
      subject: "Founders' Day has been assigned to you",
      body: "Founders' Day for Acme Holdings is now yours to review. Requested for Wed, 4 Nov 2026.",
      redirect: { url: "/staff/coordinator/42", target: "_self" },
    });
  });
});
