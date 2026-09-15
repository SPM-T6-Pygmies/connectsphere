import { describe, expect, it } from "vitest";

import { loginSchema } from "./login-schema";

describe("loginSchema", () => {
  it("accepts an email and a password", () => {
    const parsed = loginSchema.safeParse({ email: "organiser@test.com", password: "secret" });

    expect(parsed.success).toBe(true);
  });

  it("rejects a sign-in with no password", () => {
    const parsed = loginSchema.safeParse({ email: "organiser@test.com", password: "" });

    expect(parsed.success).toBe(false);
  });

  it("rejects a sign-in with no email", () => {
    const parsed = loginSchema.safeParse({ email: "", password: "secret" });

    expect(parsed.success).toBe(false);
  });
});
