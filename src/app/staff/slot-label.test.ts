import { describe, expect, it } from "vitest";

import { formatOccupied, slotLabel } from "./slot-label";

describe("slotLabel (SPM-46)", () => {
  it("names each slot with its hours", () => {
    expect(slotLabel("AM")).toBe("AM (7:00 AM – 12:00 PM)");
    expect(slotLabel("PM")).toBe("PM (1:00 PM – 6:00 PM)");
  });

  it("shows Night ending at midnight as 12:00 AM", () => {
    expect(slotLabel("Night")).toBe("Night (7:00 PM – 12:00 AM)");
  });
});

describe("formatOccupied (SPM-19)", () => {
  const times = [{ date: "2026-12-14", start: "10:00", end: "12:00" }];

  it("names the time the room is used with setup and turnaround, and each value, for Main Hall 30 and 45", () => {
    expect(formatOccupied(times, { setupMinutes: 30, turnaroundMinutes: 45 })).toBe(
      "room in use 2026-12-14 09:30–12:45 (setup 30 min, turnaround 45 min)",
    );
  });

  it("splits a window that runs past midnight by date", () => {
    expect(
      formatOccupied([{ date: "2026-12-17", start: "22:00", end: "24:00" }], { setupMinutes: 30, turnaroundMinutes: 45 }),
    ).toBe("room in use 2026-12-17 21:30–24:00, 2026-12-18 00:00–00:45 (setup 30 min, turnaround 45 min)");
  });

  it("says nothing for a venue with none set, or 0 and 0, since nothing is added", () => {
    expect(formatOccupied(times, { setupMinutes: null, turnaroundMinutes: null })).toBeNull();
    expect(formatOccupied(times, { setupMinutes: 0, turnaroundMinutes: 0 })).toBeNull();
    expect(formatOccupied(times, null)).toBeNull();
  });
});
