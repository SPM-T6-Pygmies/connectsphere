import { describe, expect, it } from "vitest";

import {
  requestClarificationSchema,
  resolveClarificationSchema,
} from "./request-clarification-schema";

describe("requestClarificationSchema (SPM-33)", () => {
  it("accepts a request id and a message", () => {
    const parsed = requestClarificationSchema.parse({
      id: "request-1",
      message: "How many need step-free access?",
    });

    expect(parsed).toEqual({ id: "request-1", message: "How many need step-free access?" });
  });

  it("trims the id, so a stray space in the form value still identifies the request", () => {
    expect(requestClarificationSchema.parse({ id: "  request-1  ", message: "Why?" }).id).toBe(
      "request-1",
    );
  });

  it.each(["", "   "])("refuses a missing event request id (%j)", (id) => {
    expect(requestClarificationSchema.safeParse({ id, message: "Why?" }).success).toBe(false);
  });

  it("passes a blank message through -- whether it says anything is the domain's call", () => {
    // `returnEventRequest` raises ClarificationMessageRequiredError, so the
    // rule has one home rather than two that can drift.
    expect(requestClarificationSchema.safeParse({ id: "request-1", message: "   " }).success).toBe(
      true,
    );
  });

  it("refuses a message that is not a string at all", () => {
    expect(requestClarificationSchema.safeParse({ id: "request-1", message: 7 }).success).toBe(
      false,
    );
  });
});

describe("resolveClarificationSchema (SPM-33)", () => {
  it("accepts a request id on its own", () => {
    expect(resolveClarificationSchema.parse({ id: "request-1" })).toEqual({ id: "request-1" });
  });

  it.each(["", "   "])("refuses a missing event request id (%j)", (id) => {
    expect(resolveClarificationSchema.safeParse({ id }).success).toBe(false);
  });
});
