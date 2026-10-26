import { workflow } from "@novu/framework";

import { venueBookingFlaggedMessage } from "@/adapters/outbound/notification-content/venue-booking-flagged";
import type { VenueBookingFlaggedNotice } from "@/core/ports/outbound/notifier";

export const VENUE_BOOKING_FLAGGED_WORKFLOW_ID = "venue-booking-flagged";

/**
 * The Inbox entry a coordinator sees when one of their bookings is flagged
 * (SPM-71): the shared wording, plus a click that opens the booking on the
 * event's Venue tab (SPM-459), where its flag is listed (AC5).
 */
export function venueBookingFlaggedInApp(notice: VenueBookingFlaggedNotice) {
  const url = `/staff/coordinator/events/${notice.eventId}?tab=venue&booking=${notice.bookingId}`;
  return {
    ...venueBookingFlaggedMessage(notice),
    redirect: { url, target: "_self" as const },
  };
}

export const venueBookingFlagged = workflow(
  VENUE_BOOKING_FLAGGED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => venueBookingFlaggedInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Booking flagged",
    // A flagged booking may no longer hold the event, and only the coordinator
    // acts on it, so no coordinator may switch this off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [VENUE_BOOKING_FLAGGED_WORKFLOW_ID],
    // Mirrors `VenueBookingFlaggedNotice`; the notifier sends it whole.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        bookingId: { type: "string" },
        eventId: { type: "string" },
        eventName: { type: "string" },
        venueLocation: { type: "string" },
        reasonCode: { type: "string", enum: ["venue-unavailable", "venue-attributes"] },
        reasons: { type: "array", items: { type: "string" } },
      },
      required: [
        "recipientUserAccountId",
        "bookingId",
        "eventId",
        "eventName",
        "venueLocation",
        "reasonCode",
        "reasons",
      ],
      additionalProperties: false,
    } as const,
  },
);
