import { describe, expect, it } from "vitest";

import { joinSlots, rangeEndsAt, rangeStartsAt, type TimeRangeOnDate } from "./event-times";

/** The 15-minute rows from `from` up to `to`, as the event_slot reads report them. */
function quarters(date: string, from: string, to: string): TimeRangeOnDate[] {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const clock = (total: number) =>
    `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  const rows: TimeRangeOnDate[] = [];
  for (let at = minutes(from); at < minutes(to); at += 15) {
    rows.push({ date, start: clock(at), end: clock(at + 15) });
  }
  return rows;
}

describe("event times (SPM-326)", () => {
  describe("joinSlots", () => {
    it("joins a converted AM slot's twenty rows into 07:00-12:00", () => {
      expect(joinSlots(quarters("2026-11-04", "07:00", "12:00"))).toEqual([
        { date: "2026-11-04", start: "07:00", end: "12:00" },
      ]);
    });

    it("keeps AM and PM apart, so the 12:00-13:00 gap stays", () => {
      expect(
        joinSlots([
          ...quarters("2026-11-04", "07:00", "12:00"),
          ...quarters("2026-11-04", "13:00", "18:00"),
        ]),
      ).toEqual([
        { date: "2026-11-04", start: "07:00", end: "12:00" },
        { date: "2026-11-04", start: "13:00", end: "18:00" },
      ]);
    });

    it("keeps a range that runs to midnight ending at 24:00", () => {
      expect(joinSlots(quarters("2026-11-04", "23:30", "24:00"))).toEqual([
        { date: "2026-11-04", start: "23:30", end: "24:00" },
      ]);
    });

    it("does not join the end of one day to the start of the next", () => {
      expect(
        joinSlots([
          ...quarters("2026-11-05", "00:00", "00:30"),
          ...quarters("2026-11-04", "23:30", "24:00"),
        ]),
      ).toEqual([
        { date: "2026-11-04", start: "23:30", end: "24:00" },
        { date: "2026-11-05", start: "00:00", end: "00:30" },
      ]);
    });

    it("orders by date then start whatever order the rows come in", () => {
      const rows = [...quarters("2026-11-04", "09:00", "10:00")].reverse();
      expect(joinSlots(rows)).toEqual([{ date: "2026-11-04", start: "09:00", end: "10:00" }]);
    });

    it("gives nothing for no slots", () => {
      expect(joinSlots([])).toEqual([]);
    });
  });

  describe("rangeStartsAt and rangeEndsAt", () => {
    const range = { date: "2026-11-04", start: "19:00", end: "24:00" };

    it("reads the times as Singapore time", () => {
      expect(rangeStartsAt(range)).toEqual(new Date("2026-11-04T11:00:00Z"));
    });

    it("ends a 24:00 range at the next day's midnight", () => {
      expect(rangeEndsAt(range)).toEqual(new Date("2026-11-05T00:00:00+08:00"));
    });
  });
});
