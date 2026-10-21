import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bookingCancellable } from "@/core/domain/booking";
import type { VenueSuitability } from "@/core/domain/venue-suitability";
import type { EventBookingFlag } from "@/core/ports/outbound/booking-flag-repository";
import type {
  CoordinatorEventDetails,
  EventBookingSummary,
  Venue,
} from "@/core/use-cases/view-venue-booking-options";

import { EmptyState } from "../../../../field-list";
import { formatHoldExpiry } from "../../../../hold-expiry";
import { StatusBadge } from "../../../../status-badge";
import { SuitabilityChecklist } from "../../../../suitability-checklist";
import { CancelBookingForm } from "./cancel-booking-form";
import { ChangeLayoutForm } from "./change-layout-form";
import { FlaggedBadge } from "./flagged-badge";

export function BookingsTable({
  bookings,
  venues,
  event,
  suitability,
  openedBookingId,
  flags,
}: {
  /** SPM-313: the event's open flags; a booking with some shows a Flagged badge. */
  flags: readonly EventBookingFlag[];
  bookings: readonly EventBookingSummary[];
  venues: readonly Venue[];
  event: CoordinatorEventDetails;
  /** SPM-45: the server's verdict per booking still in play, by booking id. */
  suitability: Readonly<Record<string, VenueSuitability>>;
  /** SPM-62 AC3: the booking a notification opened, picked out in the list. */
  openedBookingId: string | undefined;
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
          <TableHead>Venue Staff&apos;s answer</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => {
          const venue = venues.find((candidate) => candidate.id === booking.venueId);
          const verdict = suitability[booking.id];

          return (
            <TableRow
              key={booking.id}
              data-state={booking.id === openedBookingId ? "selected" : undefined}
            >
              <TableCell className="font-medium whitespace-normal">
                {booking.venueLocation}
                {booking.status === "Tentative Hold" && booking.holdExpiresAt !== null ? (
                  // First column, not Status: the table scrolls sideways, and the
                  // expiry is the point of a hold, so it must not sit off-screen.
                  <div className="text-muted-foreground text-xs font-normal">
                    On hold until {formatHoldExpiry(booking.holdExpiresAt)}
                  </div>
                ) : null}
              </TableCell>
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
              <TableCell className="whitespace-normal">
                <div className="space-y-2">
                  <StatusBadge status={booking.status} />
                  {flags.some((flag) => flag.bookingId === booking.id) ? (
                    <div>
                      <FlaggedBadge flags={flags.filter((flag) => flag.bookingId === booking.id)} />
                    </div>
                  ) : null}
                  {bookingCancellable(booking.status) ? (
                    <CancelBookingForm
                      eventId={event.id}
                      bookingId={booking.id}
                      venueLocation={booking.venueLocation}
                    />
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-xs whitespace-normal">
                <VenueStaffAnswer booking={booking} eventId={event.id} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * SPM-62 AC2/AC3: why Venue Staff rejected a booking, and the venue they
 * suggested instead, which the coordinator can request afresh -- the
 * suggestion is informal and books nothing (#45).
 */
function VenueStaffAnswer({
  booking,
  eventId,
}: {
  booking: EventBookingSummary;
  eventId: string;
}) {
  if (booking.rejectionNote === null) {
    return "—";
  }
  const suggestion = booking.suggestedAlternative;

  return (
    <div className="space-y-2">
      <p>{booking.rejectionNote}</p>
      {suggestion === null ? null : (
        <>
          <p className="text-muted-foreground">Suggested instead: {suggestion.location}</p>
          <Button asChild size="sm" variant="outline">
            <Link
              href={`/staff/coordinator/events/${eventId}?tab=venue&venue=${suggestion.venueId}#new-request`}
            >
              Request {suggestion.location}
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}
