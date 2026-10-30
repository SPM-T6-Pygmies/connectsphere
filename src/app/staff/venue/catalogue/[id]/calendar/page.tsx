import Link from "next/link";
import { forbidden, notFound } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { buildViewVenueCalendar, getCurrentVenueStaff } from "@/composition/container";
import { InvalidCalendarRangeError, VenueNotFoundError } from "@/core/domain/errors";
import type { VenueCalendar } from "@/core/use-cases/view-venue-calendar";

import { dayHeading } from "../../../../coordinator/venues/[venueId]/calendar-cell";
import { PageHeader, StaffShell } from "../../../../staff-shell";
import { CalendarGrid, WeekNav } from "../../../../venue-calendar-grid";

export const metadata = { title: "Venue calendar | ConnectSphere" };

const CRUMB = { label: "Venues", href: "/staff/venue/catalogue" };

/**
 * SPM-63: one week of a venue's calendar, as Venue Staff see it when a
 * confirmed booking is cancelled -- the notification opens it on the week of
 * the released dates, so the freed slots show as Available (AC4). The same
 * live read as the coordinator's calendar (SPM-43).
 */
export default async function VenueStaffCalendarPage({
  params,
  searchParams,
}: PageProps<"/staff/venue/catalogue/[id]/calendar">) {
  const staff = await getCurrentVenueStaff();
  if (staff === null) {
    forbidden();
  }

  const { id } = await params;
  const { from } = await searchParams;
  const base = `/staff/venue/catalogue/${id}/calendar`;

  let calendar: VenueCalendar;
  try {
    const viewVenueCalendar = await buildViewVenueCalendar();
    calendar = await viewVenueCalendar.execute({
      venueId: id,
      from: (Array.isArray(from) ? from[0] : from) || null,
    });
  } catch (error) {
    if (error instanceof VenueNotFoundError) notFound();
    if (!(error instanceof InvalidCalendarRangeError)) throw error;
    return (
      <StaffShell role="venue" crumbs={[CRUMB, { label: "Calendar" }]}>
        <PageHeader title="Venue calendar" />
        <Alert variant="destructive">
          <AlertDescription>
            {error.message}{" "}
            <Link href={base} className="underline underline-offset-4">
              Show this week
            </Link>
          </AlertDescription>
        </Alert>
      </StaffShell>
    );
  }

  return (
    <StaffShell
      role="venue"
      crumbs={[
        CRUMB,
        { label: calendar.venue.location, href: `/staff/venue/catalogue/${id}` },
        { label: "Calendar" },
      ]}
    >
      <PageHeader
        title={calendar.venue.location}
        description={`${dayHeading(calendar.from)} to ${dayHeading(calendar.to)}. Times are Singapore time.`}
        actions={<WeekNav base={base} from={calendar.from} />}
      />
      <div className="mt-6">
        <CalendarGrid calendar={calendar} />
      </div>
    </StaffShell>
  );
}
