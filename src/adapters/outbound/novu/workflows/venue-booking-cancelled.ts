import { workflow } from "@novu/framework";

import { venueBookingCancelledMessage } from "@/adapters/outbound/notification-content/venue-booking-cancelled";
import type { VenueBookingCancelledNotice } from "@/core/ports/outbound/notifier";

export const VENUE_BOOKING_CANCELLED_WORKFLOW_ID = "venue-booking-cancelled";

/**
 * The Inbox entry Venue Staff see when a confirmed booking is cancelled
 * (SPM-63): the shared wording, plus a click that opens the venue's calendar
 * on the week of the first released date, where the freed time shows (AC4).
 */
export function venueBookingCancelledInApp(notice: VenueBookingCancelledNotice) {
  const from = notice.times[0]?.date;
  const calendar = `/staff/venue/catalogue/${notice.venueId}/calendar`;
  return {
    ...venueBookingCancelledMessage(notice),
    redirect: {
      url: from === undefined ? calendar : `${calendar}?from=${from}`,
      target: "_self" as const,
    },
  };
}

export const venueBookingCancelled = workflow(
  VENUE_BOOKING_CANCELLED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => venueBookingCancelledInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Booking cancelled",
    // SPM-63 exists so no venue is prepared for an event that is not
    // happening, so no Venue Staff member may switch it off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [VENUE_BOOKING_CANCELLED_WORKFLOW_ID],
    // Mirrors `VenueBookingCancelledNotice`; the notifier sends it whole.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        bookingId: { type: "string" },
        venueId: { type: "string" },
        venueLocation: { type: "string" },
        eventName: { type: "string" },
        times: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              start: { type: "string" },
              end: { type: "string" },
            },
            required: ["date", "start", "end"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "recipientUserAccountId",
        "bookingId",
        "venueId",
        "venueLocation",
        "eventName",
        "times",
      ],
      additionalProperties: false,
    } as const,
  },
);
