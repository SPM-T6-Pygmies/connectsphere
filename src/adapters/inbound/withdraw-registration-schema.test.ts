import { describe, expect, it } from "vitest";

import { withdrawRegistrationSchema } from "./withdraw-registration-schema";

describe("withdrawRegistrationSchema", () => {
  it("accepts the reference the Supabase adapter issues", () => {
    const parsed = withdrawRegistrationSchema.safeParse({
      reference: "b7d0b0a4-6b2f-4f0e-9a3a-2c1d5e8f7a10",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts the reference the in-memory adapter issues", () => {
    const parsed = withdrawRegistrationSchema.safeParse({ reference: "registration-1" });

    expect(parsed.success).toBe(true);
  });

  it("rejects a missing reference", () => {
    const parsed = withdrawRegistrationSchema.safeParse({ reference: "   " });

    expect(parsed.success).toBe(false);
  });
});
