import { describe, expect, it } from "vitest";

import { decideEventRequestSchema } from "./decide-event-request-schema";

describe("decideEventRequestSchema", () => {
  it.each(["approve", "reject"])("accepts a %s decision with its record", (decision) => {
    const parsed = decideEventRequestSchema.safeParse({
      id: "request-1",
      decision,
      decisionRecord: "Enough to plan.",
    });

    expect(parsed.success).toBe(true);
  });

  it("leaves a blank decision record to the domain rather than refusing its shape", () => {
    const parsed = decideEventRequestSchema.safeParse({
      id: "request-1",
      decision: "reject",
      decisionRecord: "",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a decision it does not know", () => {
    const parsed = decideEventRequestSchema.safeParse({
      id: "request-1",
      decision: "return",
      decisionRecord: "",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a missing request id", () => {
    const parsed = decideEventRequestSchema.safeParse({
      id: "   ",
      decision: "approve",
      decisionRecord: "",
    });

    expect(parsed.success).toBe(false);
  });
});
