import { describe, expect, it } from "vitest";

import { safetyCheckRecordedInApp } from "./safety-check-recorded";

describe("safetyCheckRecordedInApp (SPM-263)", () => {
  it("AC4: opens the event in the coordinator's workspace, in the same tab", () => {
    const inApp = safetyCheckRecordedInApp({
      recipientUserAccountId: "2",
      eventId: "7",
      eventName: "Marina Bay Gala",
      outcome: "Approved",
      comments: null,
    });

    expect(inApp.redirect).toEqual({ url: "/staff/coordinator/events/7", target: "_self" });
  });
});
