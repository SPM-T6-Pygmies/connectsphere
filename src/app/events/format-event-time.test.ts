import { describe, expect, it } from "vitest";

import { eventTimes, formatDateTime } from "./format-event-time";

describe("eventTimes (SPM-326)", () => {
  it("AC2: gives a one-day event's start and end time, with no slot label", () => {
    expect(eventTimes([{ date: "2026-11-04", start: "07:00", end: "12:00" }])).toBe(
      "7:00 am – 12:00 pm",
    );
  });

  it("lists ranges apart rather than as one, so a gap is not claimed", () => {
    expect(
      eventTimes([
        { date: "2026-11-04", start: "07:00", end: "12:00" },
        { date: "2026-11-04", start: "19:00", end: "24:00" },
      ]),
    ).toBe("7:00 am – 12:00 pm, 7:00 pm – 12:00 am");
  });

  it("names the day before each range when the event runs over more than one day", () => {
    expect(
      eventTimes([
        { date: "2026-11-04", start: "13:00", end: "18:00" },
        { date: "2026-11-05", start: "07:15", end: "09:45" },
      ]),
    ).toBe("4 Nov 1:00 pm – 6:00 pm, 5 Nov 7:15 am – 9:45 am");
  });

  it("AC1: names the day before every range when asked, for staff screens", () => {
    expect(eventTimes([{ date: "2026-11-04", start: "07:00", end: "12:00" }], "Asia/Singapore", true)).toBe(
      "4 Nov 7:00 am – 12:00 pm",
    );
  });

  it("shows the times in the viewer's timezone, and names it, outside Singapore", () => {
    expect(eventTimes([{ date: "2026-11-04", start: "19:00", end: "21:30" }], "Europe/London")).toBe(
      "11:00 am – 1:30 pm (GMT)",
    );
  });

  it("names the day when the viewer's timezone moves a range onto another day", () => {
    expect(
      eventTimes(
        [
          { date: "2026-11-04", start: "07:00", end: "08:00" },
          { date: "2026-11-04", start: "19:00", end: "20:00" },
        ],
        "America/New_York",
      ),
    ).toBe("3 Nov 6:00 pm – 7:00 pm, 4 Nov 6:00 am – 7:00 am (GMT-5)");
  });
});

describe("formatDateTime", () => {
  it("reads a moment in Singapore, whatever zone it was written in", () => {
    expect(formatDateTime("2026-09-10T12:00:00Z")).toBe(formatDateTime("2026-09-10T20:00:00+08:00"));
    expect(formatDateTime("2026-09-10T12:00:00Z")).toMatch(/10 Sept? 2026, 8:00\spm/);
  });
});
