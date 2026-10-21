import { describe, expect, it } from "vitest";

import { cancelEventSchema } from "./cancel-event-schema";

describe("cancelEventSchema (SPM-55)", () => {
  it("reads the event", () => {
    expect(cancelEventSchema.parse({ id: "7" })).toEqual({ id: "7" });
  });

  it("refuses a missing event", () => {
    expect(cancelEventSchema.safeParse({ id: " " }).success).toBe(false);
  });
});
