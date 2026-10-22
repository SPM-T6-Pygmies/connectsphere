import { describe, expect, it } from "vitest";

import { timesByEvent, toEventTimes } from "./event-mapper";

describe("event times from Supabase (SPM-326)", () => {
  it("joins each event's 15-minute rows into its start and end times", () => {
    const times = timesByEvent([
      { event_id: 1, date: "2026-11-04", start: "07:00:00", end: "07:15:00" },
      { event_id: 2, date: "2026-11-05", start: "23:45:00", end: "24:00:00" },
      { event_id: 1, date: "2026-11-04", start: "07:15:00", end: "07:30:00" },
      { event_id: 1, date: "2026-11-04", start: "13:00:00", end: "13:15:00" },
    ]);

    expect(times.get(1)).toEqual([
      { date: "2026-11-04", start: "07:00", end: "07:30" },
      { date: "2026-11-04", start: "13:00", end: "13:15" },
    ]);
    expect(times.get(2)).toEqual([{ date: "2026-11-05", start: "23:45", end: "24:00" }]);
    expect(times.has(3)).toBe(false);
  });

  it("keeps only the calendar date of a date column", () => {
    expect(toEventTimes([{ date: "2026-11-04T00:00:00", start: "09:00:00", end: "09:15:00" }])).toEqual([
      { date: "2026-11-04", start: "09:00", end: "09:15" },
    ]);
  });
});
