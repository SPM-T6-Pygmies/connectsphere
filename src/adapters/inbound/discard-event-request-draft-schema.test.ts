import { describe, expect, it } from "vitest";

import { discardEventRequestDraftSchema } from "./discard-event-request-draft-schema";

describe("discardEventRequestDraftSchema (SPM-38)", () => {
  it("accepts the id of a saved draft", () => {
    const parsed = discardEventRequestDraftSchema.safeParse({ eventRequestId: "19" });

    expect(parsed.success).toBe(true);
  });

  it("rejects a form with no draft saved yet, with the message the form shows", () => {
    const parsed = discardEventRequestDraftSchema.safeParse({ eventRequestId: "" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("There is no draft to discard yet.");
  });
});
