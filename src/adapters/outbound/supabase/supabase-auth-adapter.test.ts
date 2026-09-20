import { describe, expect, it } from "vitest";

import type { SupabaseServerClient } from "@/adapters/outbound/supabase/client";

import { SupabaseAuthAdapter } from "./supabase-auth-adapter";

/** Only the auth calls these tests stub; anything else the adapter reaches for fails loudly. */
function clientWith(auth: Record<string, () => Promise<unknown>>): SupabaseServerClient {
  return { auth } as unknown as SupabaseServerClient;
}

const FORGED_SESSION = {
  data: { session: { user: { id: "someone-else" }, expires_at: 1_798_761_599 } },
  error: null,
};

describe("SupabaseAuthAdapter.getSession (SPM-118)", () => {
  it("identifies the caller from the verified token's claims", async () => {
    const adapter = new SupabaseAuthAdapter(
      clientWith({
        getClaims: async () => ({
          data: { claims: { sub: "auth-user-1", exp: 1_798_761_599 } },
          error: null,
        }),
      }),
    );

    await expect(adapter.getSession()).resolves.toEqual({
      userId: "auth-user-1",
      expiresAt: new Date(1_798_761_599 * 1000),
    });
  });

  it("has no session when the token fails verification, whatever the cookie claims", async () => {
    // `getSession()` reads the cookie as-is; a caller can write anything there.
    const adapter = new SupabaseAuthAdapter(
      clientWith({
        getClaims: async () => ({ data: null, error: new Error("invalid JWT") }),
        getSession: async () => FORGED_SESSION,
      }),
    );

    await expect(adapter.getSession()).resolves.toBeNull();
  });
});
