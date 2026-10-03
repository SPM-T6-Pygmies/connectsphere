import { describe, expect, it } from "vitest";

import { postClarificationMessageSchema } from "./post-clarification-message-schema";

describe("postClarificationMessageSchema (SPM-33)", () => {
  it("accepts a new top-level message, with no parent", () => {
    expect(
      postClarificationMessageSchema.parse({ id: "request-1", body: "Captions only." }),
    ).toEqual({ id: "request-1", body: "Captions only.", parentId: null });
  });

  it("accepts a reply, carrying the message it replies to", () => {
    expect(
      postClarificationMessageSchema.parse({
        id: "request-1",
        body: "Captions only.",
        parentId: "message-1",
      }),
    ).toEqual({ id: "request-1", body: "Captions only.", parentId: "message-1" });
  });

  it.each(["", "   "])(
    "reads an empty parentId (%j) as no parent, not as a blank one",
    (parentId) => {
      // The reply box leaves the field empty when starting a new message
      // rather than replying, so this is the common case, not an edge one.
      expect(
        postClarificationMessageSchema.parse({ id: "request-1", body: "Hello", parentId }).parentId,
      ).toBeNull();
    },
  );

  it.each(["", "   "])("refuses a missing event request id (%j)", (id) => {
    expect(postClarificationMessageSchema.safeParse({ id, body: "Hello" }).success).toBe(false);
  });

  it("passes a blank body through -- whether it says anything is the domain's call", () => {
    expect(
      postClarificationMessageSchema.safeParse({ id: "request-1", body: "   " }).success,
    ).toBe(true);
  });

  it("refuses a body that is not a string at all", () => {
    expect(postClarificationMessageSchema.safeParse({ id: "request-1", body: 7 }).success).toBe(
      false,
    );
  });
});
