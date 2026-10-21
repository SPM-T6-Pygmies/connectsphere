import { describe, expect, it } from "vitest";

import { formatRange, fromMinutes, gaps, isOnGrid, overlaps, toMinutes } from "./time-of-day";

describe("times of day on the 15-minute grid (SPM-332)", () => {
  describe("toMinutes", () => {
    it("reads HH:MM as minutes after midnight", () => {
      expect(toMinutes("00:00")).toBe(0);
      expect(toMinutes("07:15")).toBe(435);
      expect(toMinutes("23:45")).toBe(1425);
    });

    it("reads 24:00 as the end of the day", () => {
      expect(toMinutes("24:00")).toBe(1440);
    });

    it("refuses anything past 24:00", () => {
      expect(toMinutes("24:15")).toBeNull();
      expect(toMinutes("25:00")).toBeNull();
    });

    it("refuses what is not HH:MM", () => {
      expect(toMinutes("7:00")).toBeNull();
      expect(toMinutes("07:60")).toBeNull();
      expect(toMinutes("")).toBeNull();
      expect(toMinutes("noon")).toBeNull();
    });
  });

  it("writes minutes back as HH:MM, 1440 as 24:00", () => {
    expect(fromMinutes(435)).toBe("07:15");
    expect(fromMinutes(1440)).toBe("24:00");
  });

  it("is on the grid only at a quarter hour", () => {
    expect(isOnGrid(toMinutes("07:00")!)).toBe(true);
    expect(isOnGrid(toMinutes("07:15")!)).toBe(true);
    expect(isOnGrid(toMinutes("07:10")!)).toBe(false);
    expect(isOnGrid(toMinutes("07:14")!)).toBe(false);
  });

  describe("overlaps", () => {
    const morning = { start: 420, end: 720 }; // 07:00–12:00

    it("is not an overlap when one ends as the other starts", () => {
      expect(overlaps(morning, { start: 720, end: 780 })).toBe(false);
    });

    it("is an overlap by 15 minutes", () => {
      expect(overlaps(morning, { start: 705, end: 780 })).toBe(true);
    });

    it("is an overlap when one sits inside the other", () => {
      expect(overlaps(morning, { start: 480, end: 540 })).toBe(true);
    });
  });

  describe("gaps", () => {
    const am = { start: 420, end: 720 }; // 07:00–12:00

    it("finds none when the range is covered", () => {
      expect(gaps(am, [{ start: 360, end: 780 }])).toEqual([]);
    });

    it("finds none when touching ranges cover it together", () => {
      expect(gaps(am, [{ start: 600, end: 720 }, { start: 420, end: 600 }])).toEqual([]);
    });

    it("finds the uncovered end", () => {
      expect(gaps(am, [{ start: 420, end: 660 }])).toEqual([{ start: 660, end: 720 }]);
    });

    it("finds a gap between two covers", () => {
      expect(gaps({ start: 420, end: 1440 }, [am, { start: 1140, end: 1440 }])).toEqual([
        { start: 720, end: 1140 },
      ]);
    });

    it("finds the whole range when nothing covers it", () => {
      expect(gaps(am, [])).toEqual([am]);
    });
  });

  it("formats a range as times", () => {
    expect(formatRange({ start: 1140, end: 1440 })).toBe("19:00–24:00");
  });
});
