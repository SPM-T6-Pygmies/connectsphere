import { describe, expect, it } from "vitest";

import type { BookingStatus, OccupiedTime } from "./booking";
import { InvalidCalendarRangeError } from "./errors";
import type { OpeningWindow } from "./opening-hours";
import type { UnavailabilityReason } from "./venue-unavailability";
import {
  CALENDAR_MAX_DAYS,
  calendarDays,
  deriveVenueCalendar,
  type CalendarBlock,
  type CalendarDay,
  type CalendarPeriod,
} from "./venue-calendar";

const DAY = "2026-11-02";
const NOW = new Date("2026-10-13T09:00:00+08:00");
const OPEN: readonly OpeningWindow[] = [{ start: "07:00", end: "24:00" }];

function booking(
  start: string,
  end: string,
  status: BookingStatus = "Confirmed",
  holdExpiresAt: Date | null = null,
): OccupiedTime {
  return { date: DAY, start, end, status, holdExpiresAt };
}

/** A block over codes `first` to `last` (15-minute slots, SPM-331) on DAY. */
function blockOf(
  first: number,
  last: number,
  reason: UnavailabilityReason = "Maintenance",
  note: string | null = null,
): CalendarBlock[] {
  return Array.from({ length: last - first + 1 }, (_, i) => ({ date: DAY, slot: String(first + i), reason, note }));
}

function day(input: {
  openingHours?: readonly OpeningWindow[];
  occupied?: readonly OccupiedTime[];
  blocked?: readonly CalendarBlock[];
}): CalendarDay {
  const [only] = deriveVenueCalendar({
    days: [DAY],
    openingHours: input.openingHours ?? OPEN,
    occupied: input.occupied ?? [],
    blocked: input.blocked ?? [],
    now: NOW,
  });
  return only;
}

function periodAt(calendarDay: CalendarDay, start: string): CalendarPeriod {
  const found = calendarDay.periods.find((p) => p.start === start);
  if (found === undefined) {
    throw new Error(`No period starting ${start} on ${calendarDay.date}.`);
  }
  return found;
}

/** `start` to status for every period from `from` up to, not including, `to`. */
function statuses(calendarDay: CalendarDay, from: string, to: string): Record<string, string> {
  return Object.fromEntries(
    calendarDay.periods.filter((p) => p.start >= from && p.start < to).map((p) => [p.start, p.status]),
  );
}

describe("deriveVenueCalendar on the 15-minute grid (SPM-323)", () => {
  it("shows each day as the 15-minute periods of the venue's opening hours (AC1)", () => {
    const { periods } = day({ openingHours: [{ start: "09:00", end: "10:00" }] });

    expect(periods.map(({ start, end }) => `${start}-${end}`)).toEqual([
      "09:00-09:15",
      "09:15-09:30",
      "09:30-09:45",
      "09:45-10:00",
    ]);
    expect(periods.every((p) => p.status === "available")).toBe(true);
  });

  it("runs to a closing time of 24:00, the last period ending then (AC1)", () => {
    const { periods } = day({});

    expect(periods).toHaveLength(68);
    expect(periods[0]).toMatchObject({ start: "07:00", end: "07:15" });
    expect(periods[67]).toMatchObject({ start: "23:45", end: "24:00" });
  });

  it("gives every day of the week the same periods, so they line up as rows", () => {
    const days = deriveVenueCalendar({
      days: ["2026-11-02", "2026-11-03"],
      openingHours: OPEN,
      occupied: [{ ...booking("05:00", "06:00"), date: "2026-11-03" }],
      blocked: [],
      now: NOW,
    });

    expect(days.map((d) => d.date)).toEqual(["2026-11-02", "2026-11-03"]);
    expect(days[0].periods.map((p) => p.start)).toEqual(days[1].periods.map((p) => p.start));
    expect(days[0].periods[0].start).toBe("05:00");
  });

  it("marks exactly the periods of a Confirmed 10:15-11:45 booking confirmed (AC2)", () => {
    expect(statuses(day({ occupied: [booking("10:15", "11:45")] }), "10:00", "12:00")).toEqual({
      "10:00": "available",
      "10:15": "confirmed",
      "10:30": "confirmed",
      "10:45": "confirmed",
      "11:00": "confirmed",
      "11:15": "confirmed",
      "11:30": "confirmed",
      "11:45": "available",
    });
  });

  it("reads a booking kept as one row per 15 minutes the same as one kept as a span (AC2)", () => {
    const rows = ["10:15", "10:30", "10:45", "11:00", "11:15", "11:30"].map((start, i, all) =>
      booking(start, all[i + 1] ?? "11:45"),
    );

    expect(day({ occupied: rows })).toEqual(day({ occupied: [booking("10:15", "11:45")] }));
  });

  it("does not carry a booking onto another date", () => {
    const [other] = deriveVenueCalendar({
      days: ["2026-11-03"],
      openingHours: OPEN,
      occupied: [booking("10:15", "11:45")],
      blocked: [],
      now: NOW,
    });

    expect(other.periods.every((p) => p.status === "available")).toBe(true);
  });

  it.each(["Requested", "Rejected", "Released", "Cancelled", "Expired"] as const)(
    "leaves a period available under a %s booking, which holds nothing (AC1)",
    (status) => {
      expect(periodAt(day({ occupied: [booking("10:00", "10:15", status)] }), "10:00").status).toBe("available");
    },
  );

  it("marks a period under an unexpired hold held, with when it lapses (AC1)", () => {
    const expiry = new Date(NOW.getTime() + 60_000);

    expect(periodAt(day({ occupied: [booking("10:00", "10:15", "Tentative Hold", expiry)] }), "10:00")).toEqual({
      start: "10:00",
      end: "10:15",
      status: "held",
      holdExpiresAt: expiry,
      reasons: [],
      notes: [],
    });
  });

  it("shows a hold that expires exactly now as available", () => {
    expect(periodAt(day({ occupied: [booking("10:00", "10:15", "Tentative Hold", new Date(NOW))] }), "10:00").status).toBe(
      "available",
    );
  });

  it("shows a hold with no expiry as held, as the clash rule does", () => {
    expect(periodAt(day({ occupied: [booking("10:00", "10:15", "Tentative Hold", null)] }), "10:00")).toMatchObject({
      status: "held",
      holdExpiresAt: null,
    });
  });

  it("shows confirmed where a Confirmed booking and a hold share a period, whichever is read first", () => {
    const later = new Date(NOW.getTime() + 60 * 60 * 1000);
    const hold = booking("10:00", "11:00", "Tentative Hold", later);
    const confirmed = booking("10:30", "11:30");

    for (const occupied of [
      [hold, confirmed],
      [confirmed, hold],
    ]) {
      expect(statuses(day({ occupied }), "10:00", "11:30")).toEqual({
        "10:00": "held",
        "10:15": "held",
        "10:30": "confirmed",
        "10:45": "confirmed",
        "11:00": "confirmed",
        "11:15": "confirmed",
      });
    }
  });

  it("marks exactly the periods a block covers blocked (AC1)", () => {
    expect(statuses(day({ blocked: blockOf(36, 45) }), "08:45", "11:45")).toMatchObject({
      "08:45": "available",
      "09:00": "blocked",
      "11:15": "blocked",
      "11:30": "available",
    });
  });

  it("shows blocked, not confirmed, where a block covers a Confirmed booking", () => {
    expect(periodAt(day({ occupied: [booking("09:00", "10:00")], blocked: blockOf(36, 36) }), "09:00").status).toBe(
      "blocked",
    );
  });

  it("reads a block recorded on PM, before blocks moved to times, as its 15-minute periods", () => {
    const pm: CalendarBlock = { date: DAY, slot: "PM", reason: "Safety", note: null };

    expect(statuses(day({ blocked: [pm] }), "12:45", "18:15")).toMatchObject({
      "12:45": "available",
      "13:00": "blocked",
      "17:45": "blocked",
      "18:00": "available",
    });
  });

  it("widens the day to show a booking outside the opening hours, the rest of the widening closed (AC1)", () => {
    const calendarDay = day({
      openingHours: [{ start: "09:00", end: "10:00" }],
      occupied: [booking("10:30", "10:45")],
    });

    expect(statuses(calendarDay, "09:45", "11:00")).toEqual({
      "09:45": "available",
      "10:00": "closed",
      "10:15": "closed",
      "10:30": "confirmed",
    });
  });

  it("does not widen the day for a booking that holds nothing", () => {
    const calendarDay = day({
      openingHours: [{ start: "09:00", end: "10:00" }],
      occupied: [booking("10:30", "10:45", "Rejected")],
    });

    expect(calendarDay.periods.map((p) => p.start)).toEqual(["09:00", "09:15", "09:30", "09:45"]);
  });

  it("has no periods for a venue with no opening hours and nothing on it", () => {
    expect(day({ openingHours: [] }).periods).toEqual([]);
  });
});

describe("deriveVenueCalendar block reasons (SPM-323)", () => {
  it("gives a blocked period the reason Venue Staff recorded (AC3)", () => {
    expect(periodAt(day({ blocked: blockOf(52, 52, "Renovation") }), "13:00").reasons).toEqual(["Renovation"]);
  });

  it("gives every reason when overlapping blocks cover one period (AC3)", () => {
    expect(
      periodAt(day({ blocked: [...blockOf(52, 52, "Renovation"), ...blockOf(52, 52, "Safety")] }), "13:00").reasons,
    ).toEqual(["Renovation", "Safety"]);
  });

  it("lists a reason once when two blocks give the same one", () => {
    expect(periodAt(day({ blocked: [...blockOf(52, 52), ...blockOf(52, 52)] }), "13:00").reasons).toEqual([
      "Maintenance",
    ]);
  });

  it("gives each period only the reasons of the blocks that reach it (AC3)", () => {
    const calendarDay = day({ blocked: [...blockOf(44, 47, "Safety"), ...blockOf(47, 48, "Renovation")] });

    expect(periodAt(calendarDay, "11:00").reasons).toEqual(["Safety"]);
    expect(periodAt(calendarDay, "11:45").reasons).toEqual(["Safety", "Renovation"]);
    expect(periodAt(calendarDay, "12:00").reasons).toEqual(["Renovation"]);
    expect(periodAt(calendarDay, "12:15").reasons).toEqual([]);
  });

  it("gives the note Venue Staff wrote on an Other block (AC3)", () => {
    expect(
      periodAt(day({ blocked: blockOf(52, 52, "Other", "Terrace closed for resurfacing") }), "13:00").notes,
    ).toEqual(["Terrace closed for resurfacing"]);
  });

  it("gives every note when two Other blocks cover one period, each once", () => {
    expect(
      periodAt(
        day({
          blocked: [
            ...blockOf(52, 52, "Other", "Resurfacing"),
            ...blockOf(52, 52, "Other", "Film shoot"),
            ...blockOf(52, 52, "Other", "Resurfacing"),
          ],
        }),
        "13:00",
      ).notes,
    ).toEqual(["Resurfacing", "Film shoot"]);
  });

  it("gives no reason or note on a period that is not blocked", () => {
    expect(periodAt(day({ blocked: blockOf(52, 52, "Other", "Film shoot") }), "13:15")).toMatchObject({
      reasons: [],
      notes: [],
    });
  });
});

describe("calendarDays (SPM-43)", () => {
  it("lists every day from the start to the end, both included", () => {
    expect(calendarDays("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("allows a one-day range", () => {
    expect(calendarDays(DAY, DAY)).toEqual([DAY]);
  });

  it("refuses an end before the start", () => {
    expect(() => calendarDays("2026-11-02", "2026-11-01")).toThrow(InvalidCalendarRangeError);
  });

  it("refuses a date that does not exist", () => {
    expect(() => calendarDays("2026-02-30", "2026-03-01")).toThrow(InvalidCalendarRangeError);
  });

  it(`allows exactly ${CALENDAR_MAX_DAYS} days and refuses one more`, () => {
    expect(calendarDays("2026-12-01", "2026-12-31")).toHaveLength(CALENDAR_MAX_DAYS);
    expect(() => calendarDays("2026-12-01", "2027-01-01")).toThrow(InvalidCalendarRangeError);
  });
});
