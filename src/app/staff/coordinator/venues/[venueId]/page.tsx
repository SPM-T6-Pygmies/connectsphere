import Link from "next/link";
import { forbidden, notFound } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { buildViewVenueCalendar, getCurrentCoordinator } from "@/composition/container";
import { InvalidCalendarRangeError, VenueNotFoundError } from "@/core/domain/errors";
import type { VenueCalendar } from "@/core/use-cases/view-venue-calendar";

import { PageHeader, StaffShell } from "../../../staff-shell";
import { CalendarGrid, WeekNav } from "../../../venue-calendar-grid";
import { dayHeading } from "./calendar-cell";

export const metadata = { title: "Venue calendar | ConnectSphere" };

const CRUMB = { label: "Find a venue", href: "/staff/coordinator/venues" };

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
        description={`${dayHeading(calendar.from)} to ${dayHeading(calendar.to)}. Times are Singapore time.`}
        actions={<WeekNav base={`/staff/coordinator/venues/${venueId}`} from={calendar.from} />}
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
