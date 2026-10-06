import { describe, expect, it } from "vitest";

import { recordSafetyCheckSchema } from "./record-safety-check-schema";

describe("recordSafetyCheckSchema (SPM-260)", () => {
  it.each(["Approved", "Rejected"])("AC2: accepts the outcome %s", (outcome) => {
    expect(recordSafetyCheckSchema.safeParse({ eventId: "7", outcome, comments: "" }).success).toBe(true);
  });

  it.each(["Changes requested", "approve", ""])("AC2: refuses any other outcome, such as %j", (outcome) => {
    const parsed = recordSafetyCheckSchema.safeParse({ eventId: "7", outcome, comments: "" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("Choose to approve or reject.");
  });

  it("AC3: leaves blank comments to the domain rather than refusing them as a shape", () => {
    expect(recordSafetyCheckSchema.safeParse({ eventId: "7", outcome: "Rejected", comments: " " }).success).toBe(true);
  });
});
