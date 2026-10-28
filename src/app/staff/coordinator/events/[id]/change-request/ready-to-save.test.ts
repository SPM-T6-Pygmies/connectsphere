import { describe, expect, it } from "vitest";

import { readyToSave } from "./ready-to-save";

describe("readyToSave (SPM-100)", () => {
  const fields = ["times", "expected_attendance"] as const;

  it("AC2: is ready for a mixed decision with a reason on the decline", () => {
    expect(
      readyToSave(fields, {
        times: { outcome: "Accepted" },
        expected_attendance: { outcome: "Declined", reason: "Room caps at 300" },
      }),
    ).toBe(true);
  });

  it("waits while a row is undecided", () => {
    expect(readyToSave(fields, { times: { outcome: "Accepted" } })).toBe(false);
  });

  it.each(["", "   "])("AC3: waits while a decline's reason is %j", (reason) => {
    expect(
      readyToSave(fields, { times: { outcome: "Accepted" }, expected_attendance: { outcome: "Declined", reason } }),
    ).toBe(false);
  });
});
