import type { CalendarPeriod, CalendarPeriodStatus } from "@/core/domain/venue-calendar";

import { formatHoldExpiry } from "../../../hold-expiry";

/** What one calendar period reads as: its status, and a line more when there is more to say. */
export interface CalendarCellView {
  readonly status: CalendarPeriodStatus;
  readonly label: string;
  readonly detail: string | null;
}

/** SPM-323: back-to-back periods that read the same, drawn as one bar, e.g. Confirmed 10:15–11:45. */
export interface CalendarRun extends CalendarCellView {
  readonly start: string;
  readonly end: string;
}

const LABEL: Record<CalendarPeriodStatus, string> = {
  available: "Available",
  confirmed: "Confirmed",
  held: "Held",
  blocked: "Blocked",
  closed: "Closed",
};

// Calendar days are plain `YYYY-MM-DD`; read them at UTC midnight so the day never shifts.
const dayHeadingFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const longDayHeadingFormat = new Intl.DateTimeFormat("en-SG", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** SPM-155: how a period reads on the calendar. A blocked period gives its reasons (SPM-323 AC3). */
export function calendarCell(period: CalendarPeriod): CalendarCellView {
  let detail: string | null = null;
  if (period.status === "held" && period.holdExpiresAt !== null) {
    detail = `Until ${formatHoldExpiry(period.holdExpiresAt.toISOString())}`;
  } else if (period.status === "blocked" && period.reasons.length > 0) {
    // Only Other carries a note, so the notes read as part of it.
    detail = period.reasons
      .map((reason) => (reason === "Other" && period.notes.length > 0 ? `Other: ${period.notes.join("; ")}` : reason))
      .join(", ");
  }
  return { status: period.status, label: LABEL[period.status], detail };
}

/**
 * SPM-323: a day's periods as runs. A period joins the run before it when it follows straight on
 * and reads the same, so a hold lapsing at another time, or a block for another reason, starts
 * its own run. Two bookings back to back read the same, so they share one.
 */
export function calendarRuns(periods: readonly CalendarPeriod[]): CalendarRun[] {
  const runs: CalendarRun[] = [];
  for (const period of periods) {
    const cell = calendarCell(period);
    const last = runs.at(-1);
    if (last?.end === period.start && last.status === cell.status && last.detail === cell.detail) {
      runs[runs.length - 1] = { ...last, end: period.end };
    } else {
      runs.push({ ...cell, start: period.start, end: period.end });
    }
  }
  return runs;
}

/**
 * SPM-323: a venue's periods on an axis wider than its own day, closed before its first period and
 * after its last: outside them the venue is shut. A venue with no periods stays empty, as there is
 * nothing recorded to say it is closed.
 */
export function closedAround(periods: readonly CalendarPeriod[], axis: { start: string; end: string }): CalendarPeriod[] {
  const first = periods.at(0);
  const last = periods.at(-1);
  if (first === undefined || last === undefined) return [];
  const closed = (start: string, end: string): CalendarPeriod[] =>
    start < end ? [{ start, end, status: "closed", holdExpiresAt: null, reasons: [], notes: [] }] : [];
  return [...closed(axis.start, first.start), ...periods, ...closed(last.end, axis.end)];
}

/** SPM-323: a period's row heading, its own times, e.g. "10:15–10:30". Never AM, PM or Night (AC5). */
export function periodLabel({ start, end }: Pick<CalendarPeriod, "start" | "end">): string {
  return `${start}–${end}`;
}

/** A calendar day's heading, e.g. "Mon, 2 Nov". */
export function dayHeading(date: string): string {
  return dayHeadingFormat.format(new Date(`${date}T00:00:00.000Z`));
}

/** SPM-323: the one-day calendar's heading, e.g. "Monday, 2 November 2026". */
export function longDayHeading(date: string): string {
  return longDayHeadingFormat.format(new Date(`${date}T00:00:00.000Z`));
}
