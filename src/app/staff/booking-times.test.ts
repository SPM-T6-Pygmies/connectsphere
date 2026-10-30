import { describe, expect, it } from "vitest";

import { roomInUse, venueBufferNote } from "./booking-times";

describe("roomInUse (SPM-19)", () => {
  const times = [{ date: "2026-12-14", start: "10:00", end: "12:00" }];

  it("names the time the room is used with setup and turnaround, and each value, for Main Hall 30 and 45", () => {
    expect(roomInUse(times, { setupMinutes: 30, turnaroundMinutes: 45 })).toEqual({
      windows: [{ date: "2026-12-14", start: "09:30", end: "12:45" }],
      setup: 30,
      turnaround: 45,
    });
  });

  it("splits a window that runs past midnight by date", () => {
    expect(
      roomInUse([{ date: "2026-12-17", start: "22:00", end: "24:00" }], { setupMinutes: 30, turnaroundMinutes: 45 })?.windows,
    ).toEqual([
      { date: "2026-12-17", start: "21:30", end: "24:00" },
      { date: "2026-12-18", start: "00:00", end: "00:45" },
    ]);
  });

  it("says nothing for a venue with none set, or 0 and 0, since nothing is added", () => {
    expect(roomInUse(times, { setupMinutes: null, turnaroundMinutes: null })).toBeNull();
    expect(roomInUse(times, { setupMinutes: 0, turnaroundMinutes: 0 })).toBeNull();
    expect(roomInUse(times, null)).toBeNull();
  });
});

describe("venueBufferNote (SPM-19)", () => {
  it("reads a venue's two values for the note beside its name", () => {
    expect(venueBufferNote({ setupMinutes: 30, turnaroundMinutes: 45 })).toBe("Setup 30 min · Turnaround 45 min");
    expect(venueBufferNote({ setupMinutes: 0, turnaroundMinutes: 0 })).toBe("Setup 0 min · Turnaround 0 min");
  });

  it("says plainly when none are set, or the venue has gone", () => {
    expect(venueBufferNote({ setupMinutes: null, turnaroundMinutes: null })).toBe("No setup or turnaround set");
    expect(venueBufferNote(null)).toBeNull();
  });
});
