import { describe, expect, it } from "vitest";

import { formatHoldExpiry } from "./hold-expiry";

describe("formatHoldExpiry (SPM-218)", () => {
  it("shows the day and the time in Singapore, whatever zone the server runs in", () => {
    // 01:00 UTC is 09:00 in Singapore.
    const text = formatHoldExpiry("2026-10-04T01:00:00.000Z");

    expect(text).toContain("4 Oct");
    expect(text).toMatch(/9:00/);
  });

  it("rolls into the next Singapore day when the UTC instant is late in the day", () => {
    // 20:00 UTC on the 4th is 04:00 on the 5th in Singapore.
    expect(formatHoldExpiry("2026-10-04T20:00:00.000Z")).toContain("5 Oct");
  });
});
