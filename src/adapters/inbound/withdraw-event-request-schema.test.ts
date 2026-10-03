import { describe, expect, it } from "vitest";

import { withdrawEventRequestSchema } from "./withdraw-event-request-schema";

describe("withdrawEventRequestSchema (SPM-169)", () => {
  it("accepts a withdrawal with a note", () => {
    const parsed = withdrawEventRequestSchema.safeParse({
      id: "request-1",
      note: "Organiser called to withdraw.",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts a withdrawal without a note -- the note is optional", () => {
    const parsed = withdrawEventRequestSchema.safeParse({ id: "request-1", note: "" });

    expect(parsed.success).toBe(true);
  });

  it("rejects a missing request id", () => {
    const parsed = withdrawEventRequestSchema.safeParse({ id: "   ", note: "" });

    expect(parsed.success).toBe(false);
  });
});
