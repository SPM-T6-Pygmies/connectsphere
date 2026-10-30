import { slotTime } from "./booking";
import { END_OF_DAY, fromMinutes, GRID_MINUTES, isOnGrid, overlaps, toMinutes, type TimeRange } from "./time-of-day";

/** A slot code on a date: one of the `slot` table's 15-minute codes, '0' to '95' (SPM-276, SPM-331). */
export interface SlotCodeOnDate {
  readonly date: string;
  readonly slot: string;
}

/** The `slot` table's hours for one code. Throws on a code the table does not have. */
export function slotCodeRange(code: string): TimeRange {
  const { start, end } = slotTime({ date: "", slot: code });
  return { start: toMinutes(start) ?? 0, end: toMinutes(end) ?? 0 };
}

/**
 * The 15-minute codes that cover `range`, earliest first. The range must be on the grid
 * and inside the day; a block from 09:00 to 11:30 is codes '36' to '45'.
 */
export function slotCodesFor(range: TimeRange): string[] {
  if (!isOnGrid(range.start) || !isOnGrid(range.end)) {
    throw new Error(`The range ${fromMinutes(range.start)}-${fromMinutes(range.end)} is not on the 15-minute grid`);
  }
  if (range.start < 0 || range.end > END_OF_DAY || range.end <= range.start) {
    throw new Error(`The range ${fromMinutes(range.start)}-${fromMinutes(range.end)} is not a span of one day`);
  }
  const codes: string[] = [];
  for (let minute = range.start; minute < range.end; minute += GRID_MINUTES) {
    codes.push(String(minute / GRID_MINUTES));
  }
  return codes;
}

/**
 * The spans a day's slots run together as, earliest first: twenty 15-minute slots from 13:00
 * are one span 13:00-18:00. Slots that overlap or touch join.
 */
export function joinSlotCodes(codes: readonly string[]): TimeRange[] {
  const spans: TimeRange[] = [];
  for (const range of codes.map(slotCodeRange).sort((a, b) => a.start - b.start)) {
    const last = spans[spans.length - 1];
    if (last !== undefined && range.start <= last.end) {
      spans[spans.length - 1] = { start: last.start, end: Math.max(last.end, range.end) };
    } else {
      spans.push(range);
    }
  }
  return spans;
}

/**
 * The `slots` that share time with any of `others` on the same date. A booking's slots
 * '28' to '47' (07:00-12:00) are covered where a block on codes '36' to '45' (09:00-11:30)
 * sits; a slot that only touches a block (12:00 against an end of 12:00) is not covered.
 * Order follows `slots`.
 */
export function slotsOverlapping<T extends SlotCodeOnDate>(slots: readonly T[], others: readonly SlotCodeOnDate[]): T[] {
  const byDate = new Map<string, TimeRange[]>();
  for (const { date, slot } of others) {
    byDate.set(date, [...(byDate.get(date) ?? []), slotCodeRange(slot)]);
  }
  return slots.filter(({ date, slot }) => {
    const range = slotCodeRange(slot);
    return (byDate.get(date) ?? []).some((other) => overlaps(range, other));
  });
}
