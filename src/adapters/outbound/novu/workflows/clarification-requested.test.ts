import { describe, expect, it } from "vitest";

import { clarificationRequestedInApp } from "./clarification-requested";

describe("clarificationRequestedInApp (SPM-59)", () => {
  it("AC3: opens the returned request in the organiser's workspace, in the same tab", () => {
    const inApp = clarificationRequestedInApp({
      recipientUserAccountId: "3",
      eventRequestId: "42",
      eventName: "Founders' Day",
      message: "Which rooms?",
    });

    expect(inApp.redirect).toEqual({ url: "/staff/requester/42", target: "_self" });
  });
});
