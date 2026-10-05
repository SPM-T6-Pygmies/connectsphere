import { SLOT_HOURS, type SlotOnDate } from "@/core/domain/booking";

/**
 * Every date an Attendee reads, rendered in Singapore time.
 *
 * ConnectSphere's venues are all in Singapore and the system serves no other
 * timezone (#36), but that is a presentation fact. The core hands out plain
 * ISO instants; this module is the only place that decides how they read.
 */
const TIME_ZONE = "Asia/Singapore";

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-SG", { timeZone: TIME_ZONE, ...options });
}

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const weekdayFormat = formatter({ weekday: "long" });
const dayMonthFormat = formatter({ day: "numeric", month: "short" });
const fullDateFormat = formatter({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFormat = formatter({ hour: "numeric", minute: "2-digit", hour12: true });

/** A stable "which day is this, in Singapore" key, e.g. `2026-09-07`. */
export function dayKey(iso: string): string {
  return dayKeyFormat.format(new Date(iso));
}

export function weekdayOf(iso: string): string {
  return weekdayFormat.format(new Date(iso));
}

export function dayAndMonth(iso: string): string {
  return dayMonthFormat.format(new Date(iso));
}

export function fullDate(iso: string): string {
  return fullDateFormat.format(new Date(iso));
}

export function timeOfDay(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/**
 * When the event runs, slot by slot with each slot's hours, e.g.
 * "AM (7:00 am – 12:00 pm), Night (6:00 pm – 10:00 pm)". Not one range from
 * first start to last end: that would claim the slots in between. An event on
 * more than one day names the day before each slot.
 */
export function slotTimes(slots: readonly SlotOnDate[]): string {
  const multiDay = slots.some((slot) => slot.date !== slots[0].date);
  return slots
    .map(({ date, slot }) => {
      const { start, end } = SLOT_HOURS[slot];
      const hours = `${slot} (${timeOfDay(singaporeInstant(date, start))} – ${timeOfDay(singaporeInstant(date, end))})`;
      return multiDay ? `${dayAndMonth(singaporeInstant(date, start))} ${hours}` : hours;
    })
    .join(", ");
}

/** `HH:MM` on a calendar date in Singapore, as an ISO instant. */
function singaporeInstant(date: string, time: string): string {
  return `${date}T${time}:00+08:00`;
}

/**
 * The heading a group of events sits under: "Today", "Tomorrow", or the date.
 *
 * `nowIso` is passed in rather than read from the clock so the server and the
 * browser agree on what "today" means and the markup hydrates cleanly.
 */
export function dayHeading(iso: string, nowIso: string): string {
  const today = dayKey(nowIso);
  const tomorrow = dayKey(new Date(new Date(nowIso).getTime() + 24 * 60 * 60 * 1000).toISOString());

  const key = dayKey(iso);
  if (key === today) return "Today";
  if (key === tomorrow) return "Tomorrow";
  return dayAndMonth(iso);
}
