import { describe, expect, it } from "vitest";

import {
  requestClarificationSchema,
  resolveClarificationThreadSchema,
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

describe("resolveClarificationThreadSchema (SPM-33)", () => {
  it("accepts the request and the question being resolved", () => {
    expect(
      resolveClarificationThreadSchema.parse({
        id: "request-1",
        clarificationMessageId: "message-1",
      }),
    ).toEqual({ id: "request-1", clarificationMessageId: "message-1" });
  });

  it.each(["", "   "])("refuses a missing event request id (%j)", (id) => {
    expect(
      resolveClarificationThreadSchema.safeParse({ id, clarificationMessageId: "message-1" })
        .success,
    ).toBe(false);
  });

  it.each(["", "   "])("refuses a missing question id (%j)", (clarificationMessageId) => {
    // Resolving is per question, so a request id alone identifies nothing.
    expect(
      resolveClarificationThreadSchema.safeParse({ id: "request-1", clarificationMessageId })
        .success,
    ).toBe(false);
  });
});
