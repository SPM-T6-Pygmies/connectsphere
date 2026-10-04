import { describe, expect, it } from "vitest";

import { eventRequestDecidedInApp } from "./event-request-decided";

describe("eventRequestDecidedInApp (SPM-60)", () => {
  it("AC4: opens the decided request in the organiser's workspace, in the same tab", () => {
    const inApp = eventRequestDecidedInApp({
      recipientUserAccountId: "3",
      eventRequestId: "42",
      eventName: "Founders' Day",
      decision: "rejected",
      decisionRecord: "Clash.",
    });

    expect(inApp.redirect).toEqual({ url: "/staff/requester/42", target: "_self" });
  });
});
