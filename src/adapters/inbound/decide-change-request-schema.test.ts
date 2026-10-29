import { describe, expect, it } from "vitest";

import { decideChangeRequestSchema } from "./decide-change-request-schema";

describe("decideChangeRequestSchema (SPM-100)", () => {
  it("reads an accepted and a declined field", () => {
    const parsed = decideChangeRequestSchema.parse({
      eventId: "1",
      changeRequestId: "4",
      decisions: JSON.stringify([
        { field: "times", outcome: "Accepted" },
        { field: "expected_attendance", outcome: "Declined", reason: "Room caps at 300" },
      ]),
    });

    expect(parsed.decisions).toEqual([
      { field: "times", outcome: "Accepted" },
      { field: "expected_attendance", outcome: "Declined", reason: "Room caps at 300" },
    ]);
  });

  it("leaves a blank reason for the core to refuse", () => {
    const parsed = decideChangeRequestSchema.parse({
      eventId: "1",
      changeRequestId: "4",
      decisions: JSON.stringify([{ field: "times", outcome: "Declined", reason: "" }]),
    });

    expect(parsed.decisions).toEqual([{ field: "times", outcome: "Declined", reason: "" }]);
  });

  it.each([
    ["not JSON", "{"],
    ["a field that is not a change-request field", JSON.stringify([{ field: "programme", outcome: "Accepted" }])],
    ["a decline with no reason at all", JSON.stringify([{ field: "times", outcome: "Declined" }])],
    ["an outcome that is not one", JSON.stringify([{ field: "times", outcome: "Pending" }])],
  ])("refuses %s", (_label, decisions) => {
    expect(decideChangeRequestSchema.safeParse({ eventId: "1", changeRequestId: "4", decisions }).success).toBe(false);
  });
});
