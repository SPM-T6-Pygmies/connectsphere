import { workflow } from "@novu/framework";

import { venueBookingDecidedMessage } from "@/adapters/outbound/notification-content/venue-booking-decided";
import type { VenueBookingDecidedNotice } from "@/core/ports/outbound/notifier";

export const VENUE_BOOKING_DECIDED_WORKFLOW_ID = "venue-booking-decided";

/**
 * The Inbox entry a coordinator sees (SPM-62): the shared wording, plus a
 * click that opens the booking on the event's Venue tab (SPM-459), where a
 * rejected booking shows Venue Staff's answer and its suggestion can be
 * requested afresh (AC3).
 */
export function venueBookingDecidedInApp(notice: VenueBookingDecidedNotice) {
  const url = `/staff/coordinator/events/${notice.eventId}?tab=venue&booking=${notice.bookingId}`;
  return {
    ...venueBookingDecidedMessage(notice),
    redirect: { url, target: "_self" as const },
  };
}

export const venueBookingDecided = workflow(
  VENUE_BOOKING_DECIDED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => venueBookingDecidedInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Booking decided",
    // SPM-62 exists so a coordinator knows whether the venue is secured, so
    // no coordinator may switch it off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [VENUE_BOOKING_DECIDED_WORKFLOW_ID],
    // Mirrors `VenueBookingDecidedNotice`; the notifier sends it whole.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        bookingId: { type: "string" },
        eventId: { type: "string" },
        eventRequestId: { type: ["string", "null"] },
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
        outcome: { type: "string", enum: ["Confirmed", "Rejected", "Released"] },
        reason: { type: ["string", "null"] },
        suggestedAlternativeLocation: { type: ["string", "null"] },
      },
      required: [
        "recipientUserAccountId",
        "bookingId",
        "eventId",
        "eventRequestId",
        "eventName",
        "venueLocation",
        "slots",
        "outcome",
        "reason",
        "suggestedAlternativeLocation",
      ],
      additionalProperties: false,
    } as const,
  },
);
