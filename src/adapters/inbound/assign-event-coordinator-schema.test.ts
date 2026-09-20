import { describe, expect, it } from "vitest";

import { assignEventCoordinatorSchema } from "./assign-event-coordinator-schema";

describe("assignEventCoordinatorSchema (SPM-130)", () => {
  it("accepts an event request and coordinator selection", () => {
    const parsed = assignEventCoordinatorSchema.safeParse({
      eventRequestId: "request-1",
      eventCoordinatorUserAccountId: "coordinator-2",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a missing coordinator selection", () => {
    const parsed = assignEventCoordinatorSchema.safeParse({
      eventRequestId: "request-1",
      eventCoordinatorUserAccountId: "   ",
    });

    expect(parsed.success).toBe(false);
  });
});
