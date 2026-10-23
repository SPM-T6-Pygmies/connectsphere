import { describe, expect, it } from "vitest";

import { paddedWindowsClash, occupiedWindows, paddedWindows } from "./padded-window";

const DAY = "2026-12-14";
const MAIN_HALL = { setup: 30, turnaround: 45 };
const NONE = { setup: 0, turnaround: 0 };

describe("paddedWindows (SPM-23 AC6)", () => {
  it("is the customer's example: 10:00-12:00 with 30 minutes' setup and 45 turnaround occupies 09:30-12:45", () => {
    expect(paddedWindows({ date: DAY, start: "10:00", end: "12:00" }, MAIN_HALL)).toEqual([
      { date: DAY, start: "09:30", end: "12:45" },
    ]);
  });

  it("is the booked time alone when the venue has no setup or turnaround", () => {
    expect(paddedWindows({ date: DAY, start: "10:00", end: "12:00" }, NONE)).toEqual([
      { date: DAY, start: "10:00", end: "12:00" },
    ]);
  });

  it("pads only the side that has time: 0 setup with a turnaround, and the reverse", () => {
    expect(paddedWindows({ date: DAY, start: "10:00", end: "12:00" }, { setup: 0, turnaround: 45 })).toEqual([
      { date: DAY, start: "10:00", end: "12:45" },
    ]);
    expect(paddedWindows({ date: DAY, start: "10:00", end: "12:00" }, { setup: 30, turnaround: 0 })).toEqual([
      { date: DAY, start: "09:30", end: "12:00" },
    ]);
  });

  it("AC8: lets setup begin before the venue opens, which opening hours do not stop", () => {
    expect(paddedWindows({ date: DAY, start: "07:00", end: "08:00" }, MAIN_HALL)).toEqual([
      { date: DAY, start: "06:30", end: "08:45" },
    ]);
  });

  it("AC8: runs turnaround past midnight onto the next date: 23:00-24:00 with 45 minutes ends 00:45 the day after", () => {
    expect(paddedWindows({ date: "2026-12-14", start: "23:00", end: "24:00" }, MAIN_HALL)).toEqual([
      { date: "2026-12-14", start: "22:30", end: "24:00" },
      { date: "2026-12-15", start: "00:00", end: "00:45" },
    ]);
  });

  it("AC8: runs setup back onto the previous date: 00:15-01:00 with 30 minutes starts 23:45 the day before", () => {
    expect(paddedWindows({ date: "2026-12-14", start: "00:15", end: "01:00" }, MAIN_HALL)).toEqual([
      { date: "2026-12-13", start: "23:45", end: "24:00" },
      { date: "2026-12-14", start: "00:00", end: "01:45" },
    ]);
  });

  it("stops exactly at midnight without a piece on the next date: 22:00-23:00 with an hour's turnaround ends 24:00", () => {
    expect(paddedWindows({ date: DAY, start: "22:00", end: "23:00" }, { setup: 0, turnaround: 60 })).toEqual([
      { date: DAY, start: "22:00", end: "24:00" },
    ]);
  });

  it("starts exactly at midnight without a piece on the previous date: 00:30-01:30 with 30 minutes' setup starts 00:00", () => {
    expect(paddedWindows({ date: DAY, start: "00:30", end: "01:30" }, { setup: 30, turnaround: 0 })).toEqual([
      { date: DAY, start: "00:00", end: "01:30" },
    ]);
  });

  it("carries a month or year end: turnaround from 31 December reaches 1 January", () => {
    expect(paddedWindows({ date: "2026-12-31", start: "23:30", end: "24:00" }, { setup: 0, turnaround: 60 })).toEqual([
      { date: "2026-12-31", start: "23:30", end: "24:00" },
      { date: "2027-01-01", start: "00:00", end: "01:00" },
    ]);
  });

  it("AC2 limit: a full day of turnaround after a booking ending at midnight fills the whole next date", () => {
    expect(paddedWindows({ date: DAY, start: "22:00", end: "24:00" }, { setup: 0, turnaround: 1440 })).toEqual([
      { date: DAY, start: "22:00", end: "24:00" },
      { date: "2026-12-15", start: "00:00", end: "24:00" },
    ]);
  });
});

describe("occupiedWindows (SPM-23 AC7)", () => {
  const booked = { date: DAY, start: "10:00", end: "12:00" };

  it.each(["Requested", "Confirmed"] as const)("pads a %s booking", (status) => {
    expect(occupiedWindows(booked, status, MAIN_HALL)).toEqual([{ date: DAY, start: "09:30", end: "12:45" }]);
  });

  it("does not pad a Tentative Hold: it holds only the held time", () => {
    expect(occupiedWindows(booked, "Tentative Hold", MAIN_HALL)).toEqual([booked]);
  });
});

describe("paddedWindowsClash (SPM-23 AC6, AC8)", () => {
  const first = paddedWindows({ date: DAY, start: "10:00", end: "12:00" }, MAIN_HALL); // 09:30-12:45

  it("clashes when one event's turnaround runs into the next event's time: 12:15-14:00 at Main Hall", () => {
    const second = paddedWindows({ date: DAY, start: "12:15", end: "14:00" }, NONE);
    expect(paddedWindowsClash(first, second)).toBe(true);
  });

  it("clashes when turnaround meets the next event's setup, though the events are apart: 12:45 with 30 setup", () => {
    const second = paddedWindows({ date: DAY, start: "12:45", end: "14:00" }, MAIN_HALL); // setup from 12:15
    expect(paddedWindowsClash(first, second)).toBe(true);
  });

  it("accepts a booking that starts exactly when the turnaround ends: touching is not a clash", () => {
    const second = paddedWindows({ date: DAY, start: "12:45", end: "14:00" }, NONE);
    expect(paddedWindowsClash(first, second)).toBe(false);
  });

  it("accepts a booking whose padded window ends exactly when the other's begins", () => {
    const earlier = paddedWindows({ date: DAY, start: "07:00", end: "09:00" }, NONE);
    expect(paddedWindowsClash(first, earlier)).toBe(false);
    const earlierWithTurnaround = paddedWindows({ date: DAY, start: "07:00", end: "08:45" }, MAIN_HALL); // to 09:30
    expect(paddedWindowsClash(first, earlierWithTurnaround)).toBe(false);
  });

  it("clashes across midnight: a late event's turnaround into 00:45 meets a booking at 00:30 the next day", () => {
    const late = paddedWindows({ date: "2026-12-14", start: "23:00", end: "24:00" }, MAIN_HALL);
    const early = paddedWindows({ date: "2026-12-15", start: "00:30", end: "02:00" }, NONE);
    expect(paddedWindowsClash(late, early)).toBe(true);
  });

  it("does not clash with another date", () => {
    const otherDay = paddedWindows({ date: "2026-12-15", start: "10:00", end: "12:00" }, MAIN_HALL);
    expect(paddedWindowsClash(first, otherDay)).toBe(false);
  });
});
