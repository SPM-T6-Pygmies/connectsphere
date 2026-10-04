import { describe, expect, it } from "vitest";

import { organiserCoordinatorAssignedInApp } from "./organiser-coordinator-assigned";

describe("organiserCoordinatorAssignedInApp (SPM-58)", () => {
  it("AC4: opens the event request in the organiser's workspace, in the same tab", () => {
    const inApp = organiserCoordinatorAssignedInApp({
      recipientUserAccountId: "3",
      eventRequestId: "42",
      eventName: "Founders' Day",
      coordinatorName: "Arjun Nair",
    });

    expect(inApp.redirect).toEqual({ url: "/staff/requester/42", target: "_self" });
  });
});
