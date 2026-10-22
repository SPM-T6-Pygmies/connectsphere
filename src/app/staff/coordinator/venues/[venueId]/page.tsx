import Link from "next/link";
import { forbidden, notFound } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { buildViewVenueCalendar, getCurrentCoordinator } from "@/composition/container";
import { BOOKING_SLOTS } from "@/core/domain/booking";
import { InvalidCalendarRangeError, VenueNotFoundError } from "@/core/domain/errors";
import { addDays, CALENDAR_WEEK_DAYS } from "@/core/domain/venue-calendar";
import type { VenueCalendar } from "@/core/use-cases/view-venue-calendar";

import { slotLabel } from "../../../slot-label";
import { PageHeader, StaffShell } from "../../../staff-shell";
import { calendarCell, dayHeading } from "./calendar-cell";

export const metadata = { title: "Venue calendar | ConnectSphere" };

const CRUMB = { label: "Find a venue", href: "/staff/coordinator/venues" };

function WeekNav({ venueId, from }: { venueId: string; from: string }) {
  const base = `/staff/coordinator/venues/${venueId}`;
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

function CalendarGrid({ calendar }: { calendar: VenueCalendar }) {
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

/**
 * SPM-155: one week of a venue's calendar, so a Coordinator can spot a viable
 * slot before requesting a booking (SPM-43). Rendered per request, so each
 * load and each change of week reads the live bookings and blocks (AC3).
 */
export default async function VenueCalendarPage({
  params,
  searchParams,
}: PageProps<"/staff/coordinator/venues/[venueId]">) {
  const coordinator = await getCurrentCoordinator();
  if (coordinator === null) {
    forbidden();
  }

  const { venueId } = await params;
  const { from } = await searchParams;

  let calendar: VenueCalendar;
  try {
    const viewVenueCalendar = await buildViewVenueCalendar();
    calendar = await viewVenueCalendar.execute({
      venueId,
      from: (Array.isArray(from) ? from[0] : from) || null,
    });
  } catch (error) {
    if (error instanceof VenueNotFoundError) notFound();
    if (!(error instanceof InvalidCalendarRangeError)) throw error;
    return (
      <StaffShell role="coordinator" crumbs={[CRUMB, { label: "Calendar" }]}>
        <PageHeader title="Venue calendar" />
        <Alert variant="destructive">
          <AlertDescription>
            {error.message}{" "}
            <Link href={`/staff/coordinator/venues/${venueId}`} className="underline underline-offset-4">
              Show this week
            </Link>
          </AlertDescription>
        </Alert>
      </StaffShell>
    );
  }

  return (
    <StaffShell role="coordinator" crumbs={[CRUMB, { label: calendar.venue.location }]}>
      <PageHeader
        title={calendar.venue.location}
        description={`${dayHeading(calendar.from)} to ${dayHeading(calendar.to)}. Slots are Singapore time.`}
        actions={<WeekNav venueId={venueId} from={calendar.from} />}
      />
      <div className="mt-6 space-y-4">
        {/* The grid still shows: a booking or block outranks Closed, so it is never hidden. */}
        {calendar.venue.openingHours.length === 0 ? (
          <Alert>
            <AlertDescription>
              This venue has no opening hours recorded yet, so it cannot be requested. Ask Venue Staff to
              set its opening hours.
            </AlertDescription>
          </Alert>
        ) : null}
        <CalendarGrid calendar={calendar} />
      </div>
    </StaffShell>
  );
}
