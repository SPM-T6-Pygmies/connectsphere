import { SLOT_HOURS, type BookingSlot } from "./booking";
import { END_OF_DAY, fromMinutes, GRID_MINUTES, isOnGrid, toMinutes, type TimeRange } from "./time-of-day";

/**
 * A slot code on a date. The code is any the `slot` table holds: AM, PM and Night while
 * bookings and blocks are still on them, or the 15-minute codes '0' to '95' they are
 * moving to (SPM-276, SPM-331). Nothing that works with this type assumes which, so a
 * rule written for one grid keeps working while the tables move across.
 */
export interface SlotCodeOnDate {
  readonly date: string;
  readonly slot: string;
}

/** The last 15-minute code of a day: '95' is 23:45 to 24:00. */
const LAST_CODE = END_OF_DAY / GRID_MINUTES - 1;

/** The `slot` table's hours for one code. Throws on a code the table does not have. */
export function slotCodeRange(code: string): TimeRange {
  if (code in SLOT_HOURS) {
    const { start, end } = SLOT_HOURS[code as BookingSlot];
    return { start: toMinutes(start) ?? 0, end: toMinutes(end) ?? 0 };
  }
  const n = Number(code);
  if (Number.isInteger(n) && String(n) === code && n >= 0 && n <= LAST_CODE) {
    return { start: n * GRID_MINUTES, end: (n + 1) * GRID_MINUTES };
  }
  throw new Error(`Unknown slot code "${code}"`);
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
 * are one span 13:00-18:00, the same as the PM slot. Slots that overlap or touch join.
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
