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

export function timeRange(startIso: string, endIso: string): string {
  return `${timeOfDay(startIso)} – ${timeOfDay(endIso)}`;
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
