import { workflow } from "@novu/framework";

import { eventCancelledForAttendeeEmail } from "@/adapters/outbound/notification-content/attendee-event-changed";

export const EVENT_CANCELLED_FOR_ATTENDEE_WORKFLOW_ID = "attendee-event-cancelled";

/**
 * The email every Registered attendee gets when the event is cancelled
 * (SPM-69). Email only: an Attendee has no account, so no Inbox.
 */
export const eventCancelledForAttendee = workflow(
  EVENT_CANCELLED_FOR_ATTENDEE_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.email("email", async () => eventCancelledForAttendeeEmail(payload, payload.registrationUrl));
  },
  {
    name: "Event cancelled (attendee)",
    // An Attendee must not turn up to something that is not happening.
    preferences: { all: { enabled: true, readOnly: true } },
    tags: [EVENT_CANCELLED_FOR_ATTENDEE_WORKFLOW_ID],
    // Mirrors `AttendeeEventChangedNotice`, plus the link the notifier builds.
    payloadSchema: {
      type: "object",
      properties: {
        registrationId: { type: "string" },
        recipientEmail: { type: "string" },
        attendeeName: { type: "string" },
        eventName: { type: "string" },
        registrationUrl: { type: "string" },
      },
      required: ["registrationId", "recipientEmail", "attendeeName", "eventName", "registrationUrl"],
      additionalProperties: false,
    } as const,
  },
);
