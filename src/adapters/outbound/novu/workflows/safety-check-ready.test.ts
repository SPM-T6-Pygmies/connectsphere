import { describe, expect, it } from "vitest";

import { safetyCheckReadyInApp } from "./safety-check-ready";

describe("safetyCheckReadyInApp (SPM-262)", () => {
  it("AC6: opens the Awaiting check list in the Safety Officer's workspace, in the same tab", () => {
    const inApp = safetyCheckReadyInApp({
      recipientUserAccountId: "11",
      eventId: "7",
      eventName: "Harbour Lights Gala",
      preferredDate: null,
    });

    expect(inApp.redirect).toEqual({ url: "/staff/safety", target: "_self" });
  });
});
