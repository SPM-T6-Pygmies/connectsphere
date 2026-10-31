import Link from "next/link";

import { EventTimes } from "@/app/events/event-times";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { eventFacilitiesEditable } from "@/core/domain/event-facilities";
import type { ViewCoordinatorEventResult } from "@/core/use-cases/view-coordinator-event";
import type {
  CoordinatorEventDetails,
  ReRequestStart,
  ViewVenueBookingOptionsResult,
} from "@/core/use-cases/view-venue-booking-options";

import { FieldList } from "../../../../field-list";
import { BookingRequestForm } from "../venue-booking/booking-request-form";
import { BookingsTable } from "../venue-booking/bookings-table";
import { FacilitiesNeededForm } from "../venue-booking/facilities-needed-form";
import { ArrangementStatus } from "./arrangement-status";
import { FlaggedBookings } from "./flagged-bookings";

/**
 * SPM-285: what the event needs from a venue, and whether one is booked.
 *
 * SPM-459: also the coordinator's whole venue booking workspace (SPM-46) --
 * the new request form and the bookings already raised -- reached by the
 * event's id, so an event with no source request can be booked too.
 */
export function VenueTab({
  readiness,
  flaggedBookings,
  booking,
  openedBookingId,
  requestedVenueId,
}: Pick<ViewCoordinatorEventResult, "readiness" | "flaggedBookings"> & {
  booking: ViewVenueBookingOptionsResult;
  /** SPM-62 AC3: the booking a notification opened (`?booking=`), picked out in the list. */
  openedBookingId: string | undefined;
  /** SPM-62 AC3: the suggested venue to start a fresh request for (`?venue=`). */
  requestedVenueId: string | undefined;
}) {
  const { event, venues, bookings, venueSuitability, bookingSuitability, reRequest } = booking;
  // "Request <venue>" on a rejected booking starts a fresh request for it; a
  // venue id that is not one on offer is ignored.
  const initialVenueId = venues.find((venue) => venue.id === requestedVenueId)?.id;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Venue</CardTitle>
          <CardDescription>
            What the event needs from a venue. The checklist compares each venue with this, and
            Venue Staff review the request against it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ArrangementStatus readiness={readiness} type="venue" />
          <FlaggedBookings flags={flaggedBookings} />
          <FieldList
            fields={[
              { label: "Preferred date", value: event.preferredDate },
              { label: "Times", value: <EventTimes times={event.times} nameEveryDay /> },
              { label: "Expected attendance", value: event.expectedAttendance },
              { label: "Layout preference", value: event.roomLayoutPreference },
              { label: "Venue requirements", value: event.venueRequirements },
              { label: "Accessibility", value: event.accessibilityRequirements },
            ]}
          />
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Facilities needed</p>
            {eventFacilitiesEditable(event.status) ? (
              <FacilitiesNeededForm
                // Remount when the saved facilities change, so the ticks follow them.
                key={event.requiredFacilities ?? ""}
                eventId={event.id}
                saved={event.requiredFacilities ?? ""}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                {event.requiredFacilities ?? "None recorded"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card id="new-request" className="scroll-mt-16">
        {reRequest === null ? (
          <CardHeader>
            <CardTitle>New booking request</CardTitle>
            <CardDescription>
              Venues are booked by start and end time, on the quarter hour. Time another event
              already holds cannot be requested. Venue Staff review the request and approve or
              reject it.
            </CardDescription>
          </CardHeader>
        ) : (
          <ReRequestHeader reRequest={reRequest} event={event} />
        )}
        <CardContent>
          <BookingRequestForm
            // Remount when a suggestion or a re-request is picked, so the form starts from it.
            key={reRequest === null ? (initialVenueId ?? "") : `re-request-${reRequest.bookingId}`}
            initialVenueId={reRequest?.venueId ?? initialVenueId}
            initialLayout={reRequest?.roomLayout}
            initialTimes={reRequest?.times}
            replacesBookingId={reRequest?.bookingId}
            eventId={event.id}
            defaultDate={event.preferredDate}
            venues={venues}
            suitability={venueSuitability}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking requests for this event</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingsTable
            flags={booking.flaggedBookings}
            reRequestsWaiting={booking.reRequestsWaiting}
            bookings={bookings}
            venues={venues}
            event={event}
            suitability={bookingSuitability}
            openedBookingId={openedBookingId}
          />
        </CardContent>
      </Card>
    </>
  );
}

/**
 * SPM-251 AC2: the re-request names the flagged booking it replaces, and offers the venue search
 * with the event's details filled in -- the first date's times, attendance and layout -- for a
 * coordinator who wants to look wider than the list below.
 */
function ReRequestHeader({ reRequest, event }: { reRequest: ReRequestStart; event: CoordinatorEventDetails }) {
  const [first] = reRequest.times;
  const search = new URLSearchParams();
  if (first !== undefined) {
    search.set("date", first.date);
    search.set("start", first.start);
    search.set("end", first.end);
  }
  if (event.expectedAttendance !== null) {
    search.set("attendance", String(event.expectedAttendance));
  }
  if (reRequest.roomLayout !== null) {
    search.set("layout", reRequest.roomLayout);
  }

  return (
    <CardHeader>
      <CardTitle>Re-request a venue</CardTitle>
      <CardDescription>
        Replacing {reRequest.venueLocation}, booked for {reRequest.bookedFor}. The form starts from
        the event as it is now. Choose the same venue or another; the booking stays until Venue
        Staff approve this one.
      </CardDescription>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/staff/coordinator/venues?${search}`}>Search venues with these details</Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/staff/coordinator/events/${event.id}?tab=venue#new-request`}>Cancel re-request</Link>
        </Button>
      </div>
    </CardHeader>
  );
}
