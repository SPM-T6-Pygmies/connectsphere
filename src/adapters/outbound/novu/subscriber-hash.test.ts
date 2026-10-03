import { describe, expect, it } from "vitest";

import { subscriberHash } from "./subscriber-hash";

describe("subscriberHash (SPM-174)", () => {
  it("is the hex HMAC-SHA256 of the subscriber id, keyed with the secret key", () => {
    // From `printf 'user-1' | openssl dgst -sha256 -hmac 'sk_test'`.
    expect(subscriberHash("user-1", "sk_test")).toBe(
      "40053989b9a262a68dbbe8bb284a296986fd12cd4b1feaa24091c02c848fe512",
    );
  });

  it("differs per subscriber, so one member's hash does not open another's inbox", () => {
    expect(subscriberHash("user-1", "sk_test")).not.toBe(subscriberHash("user-2", "sk_test"));
  });
});
