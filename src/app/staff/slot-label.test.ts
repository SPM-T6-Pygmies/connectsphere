import { describe, expect, it } from "vitest";

import { roomInUse, slotLabel } from "./slot-label";

describe("slotLabel (SPM-46)", () => {
  it("names each slot with its hours", () => {
    expect(slotLabel("AM")).toBe("AM (7:00 AM – 12:00 PM)");
    expect(slotLabel("PM")).toBe("PM (1:00 PM – 6:00 PM)");
  });

  it("shows Night ending at midnight as 12:00 AM", () => {
    expect(slotLabel("Night")).toBe("Night (7:00 PM – 12:00 AM)");
  });
});

describe("roomInUse (SPM-19)", () => {
  const times = [{ date: "2026-12-14", start: "10:00", end: "12:00" }];

  it("names the time the room is used with setup and turnaround, and each value, for Main Hall 30 and 45", () => {
    expect(roomInUse(times, { setupMinutes: 30, turnaroundMinutes: 45 })).toEqual({
      inUse: "2026-12-14 09:30–12:45",
      setup: 30,
      turnaround: 45,
    });
  });

  it("splits a window that runs past midnight by date", () => {
    expect(
      roomInUse([{ date: "2026-12-17", start: "22:00", end: "24:00" }], { setupMinutes: 30, turnaroundMinutes: 45 })?.inUse,
    ).toBe("2026-12-17 21:30–24:00, 2026-12-18 00:00–00:45");
  });

  it("says nothing for a venue with none set, or 0 and 0, since nothing is added", () => {
    expect(roomInUse(times, { setupMinutes: null, turnaroundMinutes: null })).toBeNull();
    expect(roomInUse(times, { setupMinutes: 0, turnaroundMinutes: 0 })).toBeNull();
    expect(roomInUse(times, null)).toBeNull();
  });
});
