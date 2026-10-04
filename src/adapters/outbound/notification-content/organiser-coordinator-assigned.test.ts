import { describe, expect, it } from "vitest";

import { organiserCoordinatorAssignedMessage } from "./organiser-coordinator-assigned";

describe("organiserCoordinatorAssignedMessage (SPM-58)", () => {
  it("AC2: names the assigned coordinator as the organiser's ConnectSphere point of contact", () => {
    expect(
      organiserCoordinatorAssignedMessage({
        recipientUserAccountId: "3",
        eventRequestId: "42",
        eventName: "Founders' Day",
        coordinatorName: "Arjun Nair",
      }),
    ).toEqual({
      subject: "Arjun Nair is coordinating Founders' Day",
      body: "Arjun Nair is now your point of contact at ConnectSphere for Founders' Day.",
    });
  });

  it("still says a coordinator was assigned when their name could not be read", () => {
    expect(
      organiserCoordinatorAssignedMessage({
        recipientUserAccountId: "3",
        eventRequestId: "42",
        eventName: "Founders' Day",
        coordinatorName: null,
      }),
    ).toEqual({
      subject: "Founders' Day has a coordinator",
      body: "A coordinator is now your point of contact at ConnectSphere for Founders' Day.",
    });
  });
});
