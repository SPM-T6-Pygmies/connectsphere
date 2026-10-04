import { notFound } from "next/navigation";

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
import { checkLayoutCapacity } from "@/core/domain/booking";
import type {
  CoordinatorEventDetails,
  EventBookingSummary,
  Venue,
} from "@/core/use-cases/view-venue-booking-options";

import { EmptyState, FieldList } from "../../../field-list";
import { PageHeader, StaffShell } from "../../../staff-shell";
import { StatusBadge } from "../../../status-badge";
import { BookingRequestForm } from "./booking-request-form";
import { describeCapacity } from "../../../booking-capacity-message";
import { ChangeLayoutForm } from "./change-layout-form";

export const metadata = { title: "Request a venue | ConnectSphere" };

/** `h:mm am/pm` in Singapore time -- the system runs on Singapore time only (#36). */
function formatInstantTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "Asia/Singapore",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function eventTime(event: CoordinatorEventDetails): string | null {
  return event.startTime !== null && event.endTime !== null
    ? `${formatInstantTime(event.startTime)} – ${formatInstantTime(event.endTime)}`
    : null;
}

const TONE_CLASS = {
  ok: "text-muted-foreground",
  over: "text-destructive font-medium",
  unknown: "text-muted-foreground",
} as const;

function BookingsTable({
  bookings,
  venues,
  event,
  eventRequestId,
}: {
  bookings: readonly EventBookingSummary[];
  venues: readonly Venue[];
  event: CoordinatorEventDetails;
  eventRequestId: string;
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
          <TableHead>Times</TableHead>
          <TableHead>Layout</TableHead>
          <TableHead>Capacity</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => {
          const venue = venues.find((candidate) => candidate.id === booking.venueId);
          const capacity =
            venue === undefined
              ? null
              : describeCapacity(
                  checkLayoutCapacity(venue, booking.roomLayoutName, event.expectedAttendance),
                );

          return (
            <TableRow key={booking.id}>
              <TableCell className="font-medium">{booking.venueLocation}</TableCell>
              <TableCell className="text-muted-foreground text-xs whitespace-normal">
                {booking.slots
                  .map(({ date, start, end }) => `${date} ${start}–${end}`).join(", ")}
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
              <TableCell
                className={`text-xs whitespace-normal ${TONE_CLASS[capacity?.tone ?? "unknown"]}`}
              >
                {capacity?.text ?? "—"}
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
    notFound();
  }

  const viewVenueBookingOptions = await buildViewVenueBookingOptions();
  const result = await viewVenueBookingOptions.execute({
    eventRequestId: id,
    ...coordinator,
  });
  if (result === null) {
    notFound();
  }

  const { event, venues, bookings } = result;

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
                Venues are booked by start and end time, on the quarter hour and
                within the venue&apos;s hours. A time another event already holds
                cannot be requested.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BookingRequestForm
                eventId={event.id}
                eventRequestId={id}
                defaultDate={event.preferredDate}
                expectedAttendance={event.expectedAttendance}
                venues={venues}
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
              />
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6 lg:sticky lg:top-16 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Sent with the request</CardTitle>
              <CardDescription>
                The event&apos;s timing and requirements, for Venue Staff to
                review against.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldList
                columns={1}
                fields={[
                  { label: "Preferred date", value: event.preferredDate },
                  { label: "Time", value: eventTime(event) },
                  {
                    label: "Expected attendance",
                    value: event.expectedAttendance,
                  },
                  {
                    label: "Layout preference",
                    value: event.roomLayoutPreference,
                  },
                  {
                    label: "Venue requirements",
                    value: event.venueRequirements,
                  },
                  {
                    label: "Accessibility",
                    value: event.accessibilityRequirements,
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffShell>
  );
}
