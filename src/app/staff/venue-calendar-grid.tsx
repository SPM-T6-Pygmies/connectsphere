import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatOpeningHours } from "@/core/domain/opening-hours";
import { addDays, CALENDAR_WEEK_DAYS } from "@/core/domain/venue-calendar";
import type { VenueCalendar } from "@/core/use-cases/view-venue-calendar";

import { calendarCell, dayHeading, periodLabel } from "./coordinator/venues/[venueId]/calendar-cell";

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

/**
 * SPM-323: one row per 15-minute period, one column per day. Every day has the same periods: the
 * opening hours, widened for a booking or block outside them. The time outside is closed (AC1).
 */
export function CalendarGrid({ calendar }: { calendar: VenueCalendar }) {
  const rows = calendar.days[0]?.periods ?? [];
  const hours = calendar.venue.openingHours;
  return (
    <div className="space-y-2">
      {hours.length === 0 ? null : (
        <p className="text-muted-foreground text-sm">Open {formatOpeningHours(hours)}. Closed at other times.</p>
      )}
      {/* Scrolls in its own box, not through Table's wrapper, so the day headings stay in view. */}
      <div className="max-h-[75vh] overflow-auto rounded-xl border">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow>
              <TableHead>Time</TableHead>
              {calendar.days.map((day) => (
                <TableHead key={day.date}>{dayHeading(day.date)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={calendar.days.length + 1} className="text-muted-foreground">
                  No opening hours, bookings or blocks to show.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((period, row) => (
              <TableRow key={period.start}>
                <TableCell className="py-1 font-medium tabular-nums">{periodLabel(period)}</TableCell>
                {calendar.days.map((day) => {
                  const cell = calendarCell(day.periods[row]);
                  return (
                    <TableCell key={day.date} className="py-1 align-top">
                      <Badge variant={cell.variant}>{cell.label}</Badge>
                      {cell.detail === null ? null : (
                        <p className="text-muted-foreground mt-1 text-xs whitespace-normal">{cell.detail}</p>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
