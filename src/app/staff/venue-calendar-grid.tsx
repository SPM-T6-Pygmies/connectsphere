import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BOOKING_SLOTS } from "@/core/domain/booking";
import { addDays, CALENDAR_WEEK_DAYS } from "@/core/domain/venue-calendar";
import type { VenueCalendar } from "@/core/use-cases/view-venue-calendar";

import { calendarCell, dayHeading } from "./coordinator/venues/[venueId]/calendar-cell";
import { slotLabel } from "./slot-label";

/**
 * One week of a venue's calendar and the links between weeks, shared by every
 * role that may look at it: the coordinator finding a venue (SPM-43) and Venue
 * Staff checking a cancelled booking's freed slots (SPM-63). `base` is the
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

export function CalendarGrid({ calendar }: { calendar: VenueCalendar }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slot</TableHead>
            {calendar.days.map((day) => (
              <TableHead key={day.date}>{dayHeading(day.date)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {BOOKING_SLOTS.map((slot, row) => (
            <TableRow key={slot}>
              <TableCell className="font-medium">{slotLabel(slot)}</TableCell>
              {calendar.days.map((day) => {
                const cell = calendarCell(day.slots[row]);
                return (
                  <TableCell key={day.date} className="align-top">
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
      </Table>
    </div>
  );
}
