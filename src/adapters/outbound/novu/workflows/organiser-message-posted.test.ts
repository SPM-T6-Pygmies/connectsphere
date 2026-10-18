import { describe, expect, it } from "vitest";

import { organiserMessagePostedInApp } from "./organiser-message-posted";

describe("organiserMessagePostedInApp (SPM-164)", () => {
  it("AC3: opens the request in the coordinator's workspace, in the same tab", () => {
    const inApp = organiserMessagePostedInApp({
      recipientUserAccountId: "5",
      eventRequestId: "42",
      eventName: "Founders' Day",
      message: "Captions only.",
    });

    expect(inApp.redirect).toEqual({ url: "/staff/coordinator/42", target: "_self" });
  });
});
