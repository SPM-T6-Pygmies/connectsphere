import { describe, expect, it } from "vitest";

import { organiserMessagePostedMessage } from "./organiser-message-posted";

describe("organiserMessagePostedMessage (SPM-164)", () => {
  it("AC2: names the request and quotes the organiser's message", () => {
    expect(
      organiserMessagePostedMessage({
        recipientUserAccountId: "5",
        eventRequestId: "42",
        eventName: "Founders' Day",
        message: "Captions only, no interpretation.",
      }),
    ).toEqual({
      subject: "Founders' Day has a message from the organiser",
      body: 'The organiser wrote on Founders\' Day: "Captions only, no interpretation."',
    });
  });
});
