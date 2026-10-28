import Link from "next/link";
import { forbidden } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buildViewVenuesOnDay, getCurrentCoordinator } from "@/composition/container";
import { InvalidCalendarRangeError } from "@/core/domain/errors";
import { addDays } from "@/core/domain/venue-calendar";
import type { VenuesOnDay } from "@/core/use-cases/view-venues-on-day";

import { PageHeader, StaffShell } from "../../../staff-shell";
import { VenueTimeline } from "../../../venue-calendar-grid";
import { longDayHeading } from "../[venueId]/calendar-cell";

export const metadata = { title: "Venue availability | ConnectSphere" };

const BASE = "/staff/coordinator/venues/calendar";
const CRUMB = { label: "Find a venue", href: "/staff/coordinator/venues" };

function DayNav({ date }: { date: string }) {
  return (
    <nav aria-label="Calendar days" className="flex gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`${BASE}?date=${addDays(date, -1)}`}>Previous day</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={BASE}>Today</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`${BASE}?date=${addDays(date, 1)}`}>Next day</Link>
      </Button>
    </nav>
  );
}

/**
 * SPM-323: every venue on one day, a row each, so a Coordinator can compare
 * venues for a date. A venue's name opens its own week from that day.
 * Rendered per request, so each load reads the live bookings and blocks (AC4).
 */
export default async function VenuesOnDayPage({ searchParams }: PageProps<"/staff/coordinator/venues/calendar">) {
  const coordinator = await getCurrentCoordinator();
  if (coordinator === null) {
    forbidden();
  }

  const { date } = await searchParams;

  let day: VenuesOnDay;
  try {
    const viewVenuesOnDay = await buildViewVenuesOnDay();
    day = await viewVenuesOnDay.execute({ date: (Array.isArray(date) ? date[0] : date) || null });
  } catch (error) {
    if (!(error instanceof InvalidCalendarRangeError)) throw error;
    return (
      <StaffShell role="coordinator" crumbs={[CRUMB, { label: "Availability" }]}>
        <PageHeader title="Venue availability" />
        <Alert variant="destructive">
          <AlertDescription>
            {error.message}{" "}
            <Link href={BASE} className="underline underline-offset-4">
              Show today
            </Link>
          </AlertDescription>
        </Alert>
      </StaffShell>
    );
  }

  return (
    <StaffShell role="coordinator" crumbs={[CRUMB, { label: "Availability" }]}>
      <PageHeader
        title="Venue availability"
        description={`${longDayHeading(day.date)}. Times are Singapore time. Open a venue to see its week.`}
        actions={<DayNav date={day.date} />}
      />
      <div className="mt-6">
        <VenueTimeline
          heading="Venue"
          lanes={day.venues.map(({ venue, periods }) => ({
            key: venue.id,
            label: venue.location,
            href: `/staff/coordinator/venues/${venue.id}?from=${day.date}`,
            periods,
          }))}
        />
      </div>
    </StaffShell>
  );
}
