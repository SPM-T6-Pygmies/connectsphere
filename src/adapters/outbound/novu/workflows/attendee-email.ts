import { workflow } from "@novu/framework";

import { eventCancelledForAttendeeEmail, eventRescheduledForAttendeeEmail } from "@/adapters/outbound/notification-content/attendee-event-changed";
import type { NotificationMessage } from "@/adapters/outbound/notification-content/coordinator-assigned";
import { registrationConfirmedEmail } from "@/adapters/outbound/notification-content/registration-confirmed";
import type {
  AttendeeEventChangedNotice,
  EventRescheduledForAttendeeNotice,
  RegistrationConfirmedNotice,
} from "@/core/ports/outbound/notifier";

export const ATTENDEE_EMAIL_WORKFLOW_ID = "attendee-email";

/** Each email an Attendee can get, plus the link the notifier builds. */
export type AttendeeEmail = { readonly registrationUrl: string } & (
  | ({ readonly kind: "registration-confirmed" } & RegistrationConfirmedNotice)
  | ({ readonly kind: "rescheduled" } & EventRescheduledForAttendeeNotice)
  | ({ readonly kind: "cancelled" } & AttendeeEventChangedNotice)
);

export function attendeeEmailMessage(email: AttendeeEmail): NotificationMessage {
  switch (email.kind) {
    case "registration-confirmed":
      return registrationConfirmedEmail(email, email.registrationUrl);
    case "rescheduled":
      return eventRescheduledForAttendeeEmail(email, email.registrationUrl);
    case "cancelled":
      return eventCancelledForAttendeeEmail(email, email.registrationUrl);
  }
}

/**
 * Every email an Attendee gets: that they registered (SPM-87), and that the
 * event was rescheduled or cancelled (SPM-69). One workflow rather than three
 * because Novu's plan allows only 20 (see `novu-bridge.test.ts`). Email only:
 * an Attendee has no account, so no Inbox to put it in.
 */
export const attendeeEmail = workflow(
  ATTENDEE_EMAIL_WORKFLOW_ID,
  async ({ step, payload }) => {
    // The schema is flat, so it cannot tie each field to its kind; the notifier
    // sent an `AttendeeEmail` whole.
    await step.email("email", async () => attendeeEmailMessage(payload as AttendeeEmail));
  },
  {
    name: "Attendee email",
    // The link in it is the Attendee's only way back to their registration, and
    // they must not turn up at the old time or to something that is not happening.
    preferences: { all: { enabled: true, readOnly: true } },
    tags: [ATTENDEE_EMAIL_WORKFLOW_ID],
    // Mirrors `AttendeeEmail`.
    payloadSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["registration-confirmed", "rescheduled", "cancelled"] },
        registrationId: { type: "string" },
        recipientEmail: { type: "string" },
        attendeeName: { type: "string" },
        eventName: { type: "string" },
        startsAt: { type: "string" },
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
        venueName: { type: ["string", "null"] },
        registrationUrl: { type: "string" },
      },
      required: ["kind", "registrationId", "recipientEmail", "attendeeName", "eventName", "registrationUrl"],
      additionalProperties: false,
    } as const,
  },
);
