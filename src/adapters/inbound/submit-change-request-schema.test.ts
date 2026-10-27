import { describe, expect, it } from "vitest";

import { submitChangeRequestSchema } from "./submit-change-request-schema";

describe("submitChangeRequestSchema (SPM-52)", () => {
  it("AC1: reads every field the form can send", () => {
    const changes = [
      { field: "times", value: [{ date: "2026-12-01", start: "09:00", end: "12:00" }] },
      { field: "venue_requirements", value: "Stage" },
      { field: "expected_attendance", value: 150 },
      { field: "equipment_requirements", value: null },
      { field: "registration", value: { enabled: true, opensOn: "2026-11-01", closesOn: "2026-11-25" } },
    ];

    expect(
      submitChangeRequestSchema.parse({ eventRequestId: " 7 ", changes: JSON.stringify(changes) }),
    ).toEqual({ eventRequestId: "7", changes });
  });

  it("reads a blank attendance box as no number, for the core to refuse", () => {
    expect(
      submitChangeRequestSchema.parse({
        eventRequestId: "7",
        changes: '[{"field":"expected_attendance","value":null}]',
      }).changes,
    ).toEqual([{ field: "expected_attendance", value: Number.NaN }]);
  });

  it("leaves an empty list for the core to refuse", () => {
    expect(submitChangeRequestSchema.parse({ eventRequestId: "7", changes: "[]" }).changes).toEqual([]);
  });

  it.each([
    ["text that is not JSON", "not json"],
    ["a field that is not a change-request field", '[{"field":"programme","value":"x"}]'],
    ["Not applicable on a field that cannot take it", '[{"field":"venue_requirements","value":null}]'],
    ["attendance as text", '[{"field":"expected_attendance","value":"150"}]'],
  ])("refuses %s", (_label, changes) => {
    expect(submitChangeRequestSchema.safeParse({ eventRequestId: "7", changes }).success).toBe(false);
  });

  it("refuses a missing request id", () => {
    expect(submitChangeRequestSchema.safeParse({ eventRequestId: " ", changes: "[]" }).success).toBe(false);
  });
});
