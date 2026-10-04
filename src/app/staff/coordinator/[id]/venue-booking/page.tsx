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
import type { EventBookingSummary } from "@/core/use-cases/view-venue-booking-options";

import { EmptyState, FieldList } from "../../../field-list";
import { formatSlotsOnDates } from "../../../slot-label";
import { PageHeader, StaffShell } from "../../../staff-shell";
import { StatusBadge } from "../../../status-badge";
import { BookingRequestForm } from "./booking-request-form";

export const metadata = { title: "Request a venue | ConnectSphere" };

function BookingsTable({ bookings }: { bookings: readonly EventBookingSummary[] }) {
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
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => (
          <TableRow key={booking.id}>
            <TableCell className="font-medium">{booking.venueLocation}</TableCell>
            <TableCell className="text-muted-foreground text-xs whitespace-normal">
              {booking.slots.map(({ date, slot }) => `${date} ${slot}`).join(", ")}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {booking.roomLayoutName ?? "—"}
            </TableCell>
            <TableCell>
              <StatusBadge status={booking.status} />
            </TableCell>
          </TableRow>
        ))}
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
  const result = await viewVenueBookingOptions.execute({ eventRequestId: id, ...coordinator });
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
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Booking requests for this event</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingsTable bookings={bookings} />
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
                  { label: "Slots", value: formatSlotsOnDates(event.slots) },
                  { label: "Expected attendance", value: event.expectedAttendance },
                  { label: "Layout preference", value: event.roomLayoutPreference },
                  { label: "Venue requirements", value: event.venueRequirements },
                  { label: "Accessibility", value: event.accessibilityRequirements },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffShell>
  );
}
