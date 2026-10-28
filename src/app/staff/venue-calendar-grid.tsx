import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatOpeningHours } from "@/core/domain/opening-hours";
import { toMinutes } from "@/core/domain/time-of-day";
import { addDays, CALENDAR_WEEK_DAYS, type CalendarPeriod, type CalendarPeriodStatus } from "@/core/domain/venue-calendar";
import type { VenueCalendar } from "@/core/use-cases/view-venue-calendar";

import { calendarRuns, dayHeading, periodLabel } from "./coordinator/venues/[venueId]/calendar-cell";

/**
 * One week of a venue's calendar and the links between weeks, shared by every
 * role that may look at it: the coordinator finding a venue (SPM-43) and Venue
 * Staff checking a cancelled booking's freed time (SPM-63). `base` is the
 * calendar's own path, which differs by role.
 */
export function WeekNav({ base, from }: { base: string; from: string }) {
  return (
    <nav aria-label="Calendar weeks" className="flex gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`${base}?from=${addDays(from, -CALENDAR_WEEK_DAYS)}`}>Previous week</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={base}>This week</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`${base}?from=${addDays(from, CALENDAR_WEEK_DAYS)}`}>Next week</Link>
      </Button>
    </nav>
  );
}

/** One row of the timeline: a day of one venue, or one venue on a day. */
export interface TimelineLane {
  readonly key: string;
  readonly label: string;
  readonly href?: string;
  readonly periods: readonly CalendarPeriod[];
}

/** Blue is booked, amber is waiting on the venue, red is blocked, hatched grey is never bookable. */
const BAR: Record<CalendarPeriodStatus, string> = {
  available: "",
  confirmed: "border-blue-700 bg-blue-500/80 text-white",
  held: "border-amber-600 bg-amber-300/80 text-amber-950",
  blocked: "border-rose-700 bg-rose-500/75 text-white",
  closed: "border-zinc-400 bg-zinc-200 text-zinc-600 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-300",
};

// Hatching on everything but Available, so a status is never told by colour alone.
const HATCH = "bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgb(255_255_255/0.25)_5px_10px)]";

const LEGEND: readonly { status: CalendarPeriodStatus; label: string }[] = [
  { status: "available", label: "Available" },
  { status: "confirmed", label: "Confirmed" },
  { status: "held", label: "Held" },
  { status: "blocked", label: "Blocked" },
  { status: "closed", label: "Closed" },
];

/** Under an hour, a bar is too narrow for words; its times and status are on hover. */
const LABELLED_MINUTES = 60;

const minutes = (time: string) => toMinutes(time) ?? 0;

/**
 * SPM-323: lanes on one time axis, left to right on the 15-minute grid, each period drawn where it
 * falls and back-to-back periods that read the same joined into one bar. The axis runs whole hours,
 * from the earliest period of any lane to the latest.
 */
export function VenueTimeline({ heading, lanes }: { heading?: string; lanes: readonly TimelineLane[] }) {
  const all = lanes.flatMap((lane) => lane.periods);
  if (all.length === 0) {
    return <p className="text-muted-foreground rounded-xl border p-4 text-sm">No opening hours, bookings or blocks to show.</p>;
  }
  const first = Math.floor(Math.min(...all.map((p) => minutes(p.start))) / 60) * 60;
  const last = Math.ceil(Math.max(...all.map((p) => minutes(p.end))) / 60) * 60;
  const span = last - first;
  const hours = Array.from({ length: span / 60 }, (_, i) => first + i * 60);
  const at = (time: string) => `${((minutes(time) - first) / span) * 100}%`;
  // Dotted quarter-hour lines, a solid one on each hour.
  const grid = {
    backgroundImage:
      "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to right, color-mix(in oklch, var(--border) 60%, transparent) 1px, transparent 1px)",
    backgroundSize: `${100 / hours.length}% 100%, ${100 / (hours.length * 4)}% 100%`,
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <div className="text-sm" style={{ minWidth: `calc(14rem + ${hours.length * 4}rem)` }}>
          <div className="bg-muted/40 flex border-b">
            <div className="bg-background sticky left-0 z-10 w-56 shrink-0 border-r px-3 py-2 font-medium">
              {heading}
            </div>
            <div className="relative flex flex-1">
              {hours.map((hour) => (
                <div key={hour} className="flex-1 border-l px-1 py-2 text-xs tabular-nums first:border-l-0">
                  {String(hour / 60).padStart(2, "0")}:00
                </div>
              ))}
            </div>
          </div>
          <ul>
            {lanes.map((lane) => (
              <li key={lane.key} className="flex border-b last:border-b-0">
                <div className="bg-background sticky left-0 z-10 w-56 shrink-0 truncate border-r px-3 py-2" title={lane.label}>
                  {lane.href === undefined ? (
                    lane.label
                  ) : (
                    <Link href={lane.href} className="text-primary hover:underline">
                      {lane.label}
                    </Link>
                  )}
                </div>
                <div className="relative h-10 flex-1" style={grid}>
                  {lane.periods.length === 0 ? (
                    <span className="text-muted-foreground absolute inset-y-0 left-2 flex items-center text-xs">
                      No opening hours recorded
                    </span>
                  ) : null}
                  {calendarRuns(lane.periods).map((run) => {
                    const time = periodLabel(run);
                    const words = run.detail === null ? run.label : `${run.label}: ${run.detail}`;
                    return (
                      <div
                        key={run.start}
                        title={`${time} ${words}`}
                        className={`absolute inset-y-1 overflow-hidden rounded-sm px-1.5 text-xs leading-8 whitespace-nowrap ${
                          run.status === "available" ? "" : `border ${BAR[run.status]} ${HATCH}`
                        }`}
                        style={{ left: at(run.start), width: `calc(${at(run.end)} - ${at(run.start)})` }}
                      >
                        <span className="sr-only">
                          {time} {words}
                        </span>
                        {run.status === "available" || minutes(run.end) - minutes(run.start) < LABELLED_MINUTES ? null : (
                          <span aria-hidden>{words}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ul className="flex flex-wrap justify-end gap-2 text-xs" aria-label="Key">
        {LEGEND.map(({ status, label }) => (
          <li key={status} className="flex items-center gap-1.5">
            <span
              className={`inline-block size-4 rounded-sm border ${status === "available" ? "bg-background" : `${BAR[status]} ${HATCH}`}`}
            />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * SPM-323: one week of one venue, a row per day. Every day has the same periods: the opening
 * hours, widened for a booking or block outside them. The time outside is closed (AC1).
 */
export function CalendarGrid({ calendar }: { calendar: VenueCalendar }) {
  const hours = calendar.venue.openingHours;
  return (
    <div className="space-y-2">
      {hours.length === 0 ? null : (
        <p className="text-muted-foreground text-sm">Open {formatOpeningHours(hours)}. Closed at other times.</p>
      )}
      <VenueTimeline
        lanes={calendar.days.map((day) => ({ key: day.date, label: dayHeading(day.date), periods: day.periods }))}
      />
    </div>
  );
}
