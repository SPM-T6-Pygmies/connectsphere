import { describe, expect, it } from "vitest";

import { registerForEventSchema } from "./register-for-event-schema";

const VALID = {
  eventId: "1",
  fullName: "Grace Hopper",
  email: "grace@example.com",
};

describe("registerForEventSchema", () => {
  /**
   * The id in the form is whatever the catalogue issued, and the store numbers
   * its rows. A boundary that insists on a uuid rejects every real event before
   * any of the domain's rules get a chance to run.
   */
  it("accepts the id shape the event catalogue actually issues", () => {
    const parsed = registerForEventSchema.safeParse(VALID);

    expect(parsed.success).toBe(true);
  });

  it("rejects a missing event id", () => {
    const parsed = registerForEventSchema.safeParse({ ...VALID, eventId: "" });

    expect(parsed.success).toBe(false);
  });

  it("rejects a blank name and a malformed email", () => {
    const parsed = registerForEventSchema.safeParse({
      ...VALID,
      fullName: "   ",
      email: "not-an-address",
    });

    expect(parsed.success).toBe(false);
  });
});
