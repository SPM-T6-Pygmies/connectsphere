import { workflow } from "@novu/framework";

import { holdExpiredMessage } from "@/adapters/outbound/notification-content/hold-expired";
import type { HoldExpiredNotice } from "@/core/ports/outbound/notifier";

export const HOLD_EXPIRED_WORKFLOW_ID = "hold-expired";

/**
 * The Inbox entry a coordinator sees when a hold expires (SPM-254): the shared
 * wording, plus a click that opens the booking on the event's Request a venue
 * page, where they can request the venue again or arrange another. An event
 * with no request has no such page, so it opens the event instead.
 */
export function holdExpiredInApp(notice: HoldExpiredNotice) {
  const url =
    notice.eventRequestId === null
      ? `/staff/coordinator/events/${notice.eventId}`
      : `/staff/coordinator/${notice.eventRequestId}/venue-booking?booking=${notice.bookingId}`;
  return {
    ...holdExpiredMessage(notice),
    redirect: { url, target: "_self" as const },
  };
}

export const holdExpired = workflow(
  HOLD_EXPIRED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.inApp("inbox", async () => holdExpiredInApp(payload));
  },
  {
    // What the preferences sheet calls it (SPM-180).
    name: "Hold expired",
    // A lapsed hold means the venue is no longer secured, so no coordinator
    // may switch this off.
    preferences: { all: { enabled: true, readOnly: true } },
    // The staff inbox names a notification's trigger by this tag (SPM-174).
    tags: [HOLD_EXPIRED_WORKFLOW_ID],
    // Mirrors `HoldExpiredNotice`; the notifier sends it whole.
    payloadSchema: {
      type: "object",
      properties: {
        recipientUserAccountId: { type: "string" },
        bookingId: { type: "string" },
        eventId: { type: "string" },
        eventRequestId: { type: ["string", "null"] },
        eventName: { type: "string" },
        venueLocation: { type: "string" },
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
        holdExpiresAt: { type: "string" },
      },
      required: [
        "recipientUserAccountId",
        "bookingId",
        "eventId",
        "eventRequestId",
        "eventName",
        "venueLocation",
        "times",
        "holdExpiresAt",
      ],
      additionalProperties: false,
    } as const,
  },
);
