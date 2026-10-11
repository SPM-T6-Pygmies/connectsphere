import { describe, expect, it } from "vitest";

import { completeEventSchema } from "./complete-event-schema";

describe("completeEventSchema (SPM-51)", () => {
  it("accepts a completion with notes, keeping them as typed", () => {
    const parsed = completeEventSchema.safeParse({ id: "event-1", notes: "  Ran over.  " });

    expect(parsed).toEqual({ success: true, data: { id: "event-1", notes: "  Ran over.  " } });
  });

  it("accepts a completion without notes -- they are optional", () => {
    expect(completeEventSchema.safeParse({ id: "event-1" }).success).toBe(true);
    expect(completeEventSchema.safeParse({ id: "event-1", notes: "" }).success).toBe(true);
  });

  it("rejects a missing event id", () => {
    expect(completeEventSchema.safeParse({ id: "   ", notes: "" }).success).toBe(false);
  });
});
