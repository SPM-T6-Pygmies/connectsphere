import { describe, expect, it } from "vitest";

import { clarificationRequestedMessage } from "./clarification-requested";

describe("clarificationRequestedMessage (SPM-59)", () => {
  it("AC2: says the request was returned and states what was asked", () => {
    expect(
      clarificationRequestedMessage({
        recipientUserAccountId: "3",
        eventRequestId: "42",
        eventName: "Founders' Day",
        message: "How many need step-free access?",
      }),
    ).toEqual({
      subject: "Founders' Day needs clarification",
      body: 'Your coordinator returned Founders\' Day with a question: "How many need step-free access?"',
    });
  });
});
