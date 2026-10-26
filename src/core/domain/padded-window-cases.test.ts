import { describe, expect, it } from "vitest";

import cases from "../../../scripts/seed-venue-padding/cases.json";
import { paddedClashes } from "./padded-window";

/**
 * SPM-19 AC7: the padded-window rule is written twice, here and in the database function
 * `booking_padded_clashes`. These cases are the one list both are held to: this test runs them
 * through the code, and `scripts/seed-venue-padding/same-answers.mjs` runs them through the
 * database, so a change to one copy that the other does not follow fails.
 */
const BUFFERS: Record<string, { setup: number; turnaround: number }> = {
  "Main Hall": { setup: 30, turnaround: 45 },
  Studio: { setup: 0, turnaround: 0 },
  "Seminar Room 2-1": { setup: 0, turnaround: 0 },
};

describe("the padded-window cases the database is also held to (SPM-19)", () => {
  it.each(cases)("AC7: $label", ({ venue, existing, request, clashes }) => {
    const found = paddedClashes(
      [{ date: request.date, start: request.start, end: request.end }],
      [{ eventName: "Other event", times: [{ date: existing.date, start: existing.start, end: existing.end }] }],
      BUFFERS[venue],
    );

    expect(found.map(({ date, start, end }) => ({ date, start, end }))).toEqual(clashes);
  });
});
