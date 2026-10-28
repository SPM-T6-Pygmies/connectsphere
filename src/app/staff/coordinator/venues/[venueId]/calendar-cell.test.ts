import { describe, expect, it } from "vitest";

import type { CalendarPeriod } from "@/core/domain/venue-calendar";

import { calendarCell, calendarRuns, closedAround, dayHeading, longDayHeading, periodLabel } from "./calendar-cell";

function slot(overrides: Partial<CalendarPeriod>): CalendarPeriod {
  return { start: "10:15", end: "10:30", status: "available", holdExpiresAt: null, reasons: [], notes: [], ...overrides };
}

describe("calendarCell (SPM-155)", () => {
  it("shows an open slot as Available, with nothing more to say", () => {
    expect(calendarCell(slot({}))).toEqual({ status: "available", label: "Available", detail: null });
  });

  it("shows a Confirmed booking as Confirmed", () => {
    expect(calendarCell(slot({ status: "confirmed" }))).toMatchObject({ label: "Confirmed", detail: null });
  });

  it("shows a hold with when it lapses, in the words the other hold pages use", () => {
    const cell = calendarCell(
      slot({ status: "held", holdExpiresAt: new Date("2026-11-05T04:00:00Z") }),
    );

    expect(cell).toMatchObject({ status: "held", label: "Held" });
    expect(cell.detail).toBe("Until Thu, 5 Nov, 12:00 pm");
  });

  it("shows a hold with no expiry without inventing one", () => {
    expect(calendarCell(slot({ status: "held" })).detail).toBeNull();
  });

  it("shows a blocked slot with the reason Venue Staff recorded", () => {
    expect(calendarCell(slot({ status: "blocked", reasons: ["Renovation"] }))).toEqual({
      status: "blocked",
      label: "Blocked",
      detail: "Renovation",
    });
  });

  it("lists every reason when overlapping blocks cover the slot", () => {
    expect(calendarCell(slot({ status: "blocked", reasons: ["Renovation", "Safety"] })).detail).toBe(
      "Renovation, Safety",
    );
  });

  it("shows a blocked slot with no reason without failing", () => {
    expect(calendarCell(slot({ status: "blocked" })).detail).toBeNull();
  });

  it("shows the note Venue Staff wrote after Other", () => {
    expect(
      calendarCell(slot({ status: "blocked", reasons: ["Other"], notes: ["Terrace closed for resurfacing"] }))
        .detail,
    ).toBe("Other: Terrace closed for resurfacing");
  });

  it("keeps the note with Other when another block gives a different reason", () => {
    expect(
      calendarCell(slot({ status: "blocked", reasons: ["Renovation", "Other"], notes: ["Film shoot"] })).detail,
    ).toBe("Renovation, Other: Film shoot");
  });

  it("gives every note when two Other blocks cover the slot", () => {
    expect(
      calendarCell(slot({ status: "blocked", reasons: ["Other"], notes: ["Resurfacing", "Film shoot"] })).detail,
    ).toBe("Other: Resurfacing; Film shoot");
  });

  it("shows Other alone when Venue Staff wrote no note", () => {
    expect(calendarCell(slot({ status: "blocked", reasons: ["Other"] })).detail).toBe("Other");
  });

  it("shows a slot the venue is closed for as Closed", () => {
    expect(calendarCell(slot({ status: "closed" }))).toMatchObject({ label: "Closed" });
  });
});

describe("calendarRuns (SPM-323)", () => {
  const at = (start: string, end: string, overrides: Partial<CalendarPeriod> = {}) => slot({ start, end, ...overrides });

  it("draws a booking from 10:15 to 11:45 as one bar, and the periods either side apart (AC2)", () => {
    const runs = calendarRuns([
      at("10:00", "10:15"),
      ...["10:15", "10:30", "10:45", "11:00", "11:15", "11:30"].map((start, i, all) =>
        at(start, all[i + 1] ?? "11:45", { status: "confirmed" }),
      ),
      at("11:45", "12:00"),
    ]);

    expect(runs.map(({ status, start, end }) => ({ status, start, end }))).toEqual([
      { status: "available", start: "10:00", end: "10:15" },
      { status: "confirmed", start: "10:15", end: "11:45" },
      { status: "available", start: "11:45", end: "12:00" },
    ]);
  });

  it("starts a new bar where a block gives a different reason (AC3)", () => {
    const runs = calendarRuns([
      at("09:00", "09:15", { status: "blocked", reasons: ["Renovation"] }),
      at("09:15", "09:30", { status: "blocked", reasons: ["Renovation", "Safety"] }),
    ]);

    expect(runs.map((run) => run.detail)).toEqual(["Renovation", "Renovation, Safety"]);
  });

  it("starts a new bar where two holds lapse at different times", () => {
    const runs = calendarRuns([
      at("14:00", "14:15", { status: "held", holdExpiresAt: new Date("2026-11-05T04:00:00Z") }),
      at("14:15", "14:30", { status: "held", holdExpiresAt: new Date("2026-11-06T04:00:00Z") }),
    ]);

    expect(runs).toHaveLength(2);
  });

  it("draws nothing for a day with no periods", () => {
    expect(calendarRuns([])).toEqual([]);
  });
});

describe("closedAround (SPM-323)", () => {
  const axis = { start: "07:00", end: "24:00" };

  it("reads the axis after a venue's closing as closed, not available (AC1)", () => {
    const runs = calendarRuns(closedAround([slot({ start: "17:45", end: "18:00" })], axis));

    expect(runs.map(({ status, start, end }) => ({ status, start, end }))).toEqual([
      { status: "closed", start: "07:00", end: "17:45" },
      { status: "available", start: "17:45", end: "18:00" },
      { status: "closed", start: "18:00", end: "24:00" },
    ]);
  });

  it("joins the axis before opening to a closed period the venue already has", () => {
    const runs = calendarRuns(
      closedAround([slot({ start: "08:00", end: "08:15", status: "closed" }), slot({ start: "08:15", end: "08:30" })], {
        start: "07:00",
        end: "08:30",
      }),
    );

    expect(runs.map(({ status, start, end }) => ({ status, start, end }))).toEqual([
      { status: "closed", start: "07:00", end: "08:15" },
      { status: "available", start: "08:15", end: "08:30" },
    ]);
  });

  it("adds nothing when the venue's day already spans the axis", () => {
    const periods = [slot({ start: "07:00", end: "07:15" }), slot({ start: "07:15", end: "07:30" })];

    expect(closedAround(periods, { start: "07:00", end: "07:30" })).toEqual(periods);
  });

  it("leaves a venue with no periods empty", () => {
    expect(closedAround([], axis)).toEqual([]);
  });
});

describe("dayHeading (SPM-155)", () => {
  it("names the weekday and date of a calendar day, whatever the server's zone", () => {
    expect(dayHeading("2026-11-02")).toBe("Mon, 2 Nov");
  });
});

describe("periodLabel (SPM-323)", () => {
  it("heads a row with the period's own times, not a slot name (AC5)", () => {
    expect(periodLabel({ start: "10:15", end: "10:30" })).toBe("10:15–10:30");
    expect(periodLabel({ start: "23:45", end: "24:00" })).toBe("23:45–24:00");
  });
});

describe("longDayHeading (SPM-323)", () => {
  it("names the weekday and full date of the day shown, whatever the server's zone", () => {
    expect(longDayHeading("2026-11-02")).toBe("Monday, 2 November 2026");
  });
});
