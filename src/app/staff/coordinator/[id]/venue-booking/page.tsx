import { forbidden } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildViewVenueBookingOptions, getCurrentCoordinator } from "@/composition/container";
import { eventFacilitiesEditable } from "@/core/domain/event-facilities";
import type { VenueSuitability } from "@/core/domain/venue-suitability";
import type {
  CoordinatorEventDetails,
  EventBookingSummary,
  Venue,
} from "@/core/use-cases/view-venue-booking-options";

import { EmptyState, FieldList } from "../../../field-list";
import { formatSlotsOnDates } from "../../../slot-label";
import { PageHeader, StaffShell } from "../../../staff-shell";
import { StatusBadge } from "../../../status-badge";
import { BookingRequestForm } from "./booking-request-form";
import { SuitabilityChecklist } from "../../../suitability-checklist";
import { ChangeLayoutForm } from "./change-layout-form";
import { FacilitiesNeededForm } from "./facilities-needed-form";

export const metadata = { title: "Request a venue | ConnectSphere" };

function BookingsTable({
  bookings,
  venues,
  event,
  eventRequestId,
  suitability,
}: {
  bookings: readonly EventBookingSummary[];
  venues: readonly Venue[];
  event: CoordinatorEventDetails;
  eventRequestId: string;
  /** SPM-45: the server's verdict per booking still in play, by booking id. */
  suitability: Readonly<Record<string, VenueSuitability>>;
}) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        title="No booking requests yet"
        description="Requests you send appear here with Venue Staff's answer."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Venue</TableHead>
          <TableHead>Slots</TableHead>
          <TableHead>Layout</TableHead>
          <TableHead>Suitability</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => {
          const venue = venues.find((candidate) => candidate.id === booking.venueId);
          const verdict = suitability[booking.id];

          return (
            <TableRow key={booking.id}>
              <TableCell className="font-medium">{booking.venueLocation}</TableCell>
              <TableCell className="text-muted-foreground text-xs whitespace-normal">
                {booking.slots.map(({ date, slot }) => `${date} ${slot}`).join(", ")}
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-normal">
                <div className="space-y-2">
                  <span>{booking.roomLayoutName ?? "—"}</span>
                  {booking.status === "Requested" && venue !== undefined ? (
                    <ChangeLayoutForm
                      // Remount when the saved layout changes, so the picker follows it.
                      key={booking.roomLayoutName ?? ""}
                      eventId={event.id}
                      eventRequestId={eventRequestId}
                      bookingId={booking.id}
                      venue={venue}
                      currentLayout={booking.roomLayoutName}
                    />
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-xs whitespace-normal">
                {verdict === undefined ? (
                  "—"
                ) : (
                  <SuitabilityChecklist
                    compact
                    suitability={verdict}
                    label={`Suitability of the booking at ${booking.venueLocation}`}
                  />
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={booking.status} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * SPM-46: the assigned Event Coordinator asks Venue Staff for a venue, on one
 * or more slots, for this event. Keyed by the approved request's id, as the
 * rest of the coordinator's event links are until events have a page of
 * their own.
 */
export default async function VenueBookingPage({
  params,
}: PageProps<"/staff/coordinator/[id]/venue-booking">) {
  const { id } = await params;

  const coordinator = await getCurrentCoordinator();
  if (coordinator === null) {
    forbidden();
  }

  const viewVenueBookingOptions = await buildViewVenueBookingOptions();
  const result = await viewVenueBookingOptions.execute({ eventRequestId: id, ...coordinator });
  if (result === null) {
    forbidden();
  }

  const { event, venues, bookings, venueSuitability, bookingSuitability } = result;

  return (
    <StaffShell
      role="coordinator"
      coordinatorSection="events"
      activeSection="events"
      crumbs={[
        { label: "My events", href: "/staff/coordinator/events" },
        { label: event.name, href: `/staff/coordinator/${id}` },
        { label: "Request a venue" },
      ]}
    >
      <PageHeader
        title="Request a venue"
        description={`${event.name} · Venue Staff review the request and approve or reject it.`}
        actions={<StatusBadge status={event.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* min-w-0: a grid item otherwise grows to its widest content, and the
            bookings table would push the whole page past a phone's width. */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>New booking request</CardTitle>
              <CardDescription>
                Venues are booked in AM, PM and Night slots. A slot another
                event already holds cannot be requested.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BookingRequestForm
                eventId={event.id}
                eventRequestId={id}
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
                bookings={bookings}
                venues={venues}
                event={event}
                eventRequestId={id}
                suitability={bookingSuitability}
              />
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6 lg:sticky lg:top-16 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Event needs</CardTitle>
              <CardDescription>
                What the event needs from a venue. The checklist compares each
                venue with this, and Venue Staff review the request against it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldList
                columns={1}
                fields={[
                  { label: "Preferred date", value: event.preferredDate },
                  { label: "Slots", value: formatSlotsOnDates(event.slots) },
                  { label: "Expected attendance", value: event.expectedAttendance },
                  { label: "Layout preference", value: event.roomLayoutPreference },
                  { label: "Venue requirements", value: event.venueRequirements },
                  { label: "Accessibility", value: event.accessibilityRequirements },
                ]}
              />
              <div className="mt-4 space-y-2 border-t pt-4">
                <p className="text-sm font-medium">Facilities needed</p>
                {eventFacilitiesEditable(event.status) ? (
                  <FacilitiesNeededForm
                    // Remount when the saved facilities change, so the ticks follow them.
                    key={event.requiredFacilities ?? ""}
                    eventId={event.id}
                    eventRequestId={id}
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
        </div>
      </div>
    </StaffShell>
  );
}
