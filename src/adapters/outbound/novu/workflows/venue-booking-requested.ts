import { workflow } from "@novu/framework";

import { venueBookingRequestedMessage } from "@/adapters/outbound/notification-content/venue-booking-requested";
import type { VenueBookingRequestedNotice } from "@/core/ports/outbound/notifier";

export const VENUE_BOOKING_REQUESTED_WORKFLOW_ID = "venue-booking-requested";

/**
 * The Inbox entry Venue Staff see (SPM-61): the shared wording, plus a click
 * that opens the booking request itself, where it is approved or rejected (AC3).
 */
export function venueBookingRequestedInApp(notice: VenueBookingRequestedNotice) {
  return {
    ...venueBookingRequestedMessage(notice),
    redirect: { url: `/staff/venue/${notice.bookingId}`, target: "_self" as const },
  };
}

export const venueBookingRequested = workflow(
  VENUE_BOOKING_REQUESTED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => venueBookingRequestedInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Booking requested",
    // SPM-61 exists so requests do not sit unreviewed, so no Venue Staff
    // member may switch it off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [VENUE_BOOKING_REQUESTED_WORKFLOW_ID],
    // Mirrors `VenueBookingRequestedNotice`; the notifier sends it whole.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        bookingId: { type: "string" },
        eventName: { type: "string" },
        venueLocation: { type: "string" },
        slots: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              slot: { type: "string", enum: ["AM", "PM", "Night"] },
            },
            required: ["date", "slot"],
            additionalProperties: false,
          },
        },
      },
      required: ["recipientUserAccountId", "bookingId", "eventName", "venueLocation", "slots"],
      additionalProperties: false,
    } as const,
  },
);
