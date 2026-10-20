import { rangeEndsAt, rangeStartsAt, type TimeRangeOnDate } from "@/core/domain/event-times";

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

/** The zone events are entered in and emails name: every venue is in Singapore (#36). */
export const VENUE_TIME_ZONE = TIME_ZONE;

/**
 * When the event runs, range by range, e.g. "7:00 am – 12:00 pm, 1:00 pm –
 * 6:00 pm" (SPM-326). Not one range from first start to last end: that would
 * claim the gap in between. An event on more than one day names the day
 * before each range.
 *
 * `timeZone` is the viewer's (SPM-326 design decision): Singapore by default,
 * which is what the server renders, and named after the times anywhere else
 * so a reader abroad knows the times are their own. `nameEveryDay` puts the
 * day before each range even on a one-day event, for staff screens that list
 * an event's dates rather than sit under a date heading.
 */
export function eventTimes(
  times: readonly TimeRangeOnDate[],
  timeZone: string = TIME_ZONE,
  nameEveryDay = false,
): string {
  const time = new Intl.DateTimeFormat("en-SG", { timeZone, hour: "numeric", minute: "2-digit", hour12: true });
  const day = new Intl.DateTimeFormat("en-SG", { timeZone, day: "numeric", month: "short" });
  const days = times.map((range) => day.format(rangeStartsAt(range)));
  const multiDay = nameEveryDay || days.some((label) => label !== days[0]);
  const ranges = times
    .map((range, index) => {
      const hours = `${time.format(rangeStartsAt(range))} – ${time.format(rangeEndsAt(range))}`;
      return multiDay ? `${days[index]} ${hours}` : hours;
    })
    .join(", ");
  if (timeZone === TIME_ZONE) {
    return ranges;
  }
  const zone = new Intl.DateTimeFormat("en-SG", { timeZone, timeZoneName: "short" })
    .formatToParts(times.length > 0 ? rangeStartsAt(times[0]) : new Date())
    .find((part) => part.type === "timeZoneName")?.value;
  return zone === undefined ? ranges : `${ranges} (${zone})`;
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
