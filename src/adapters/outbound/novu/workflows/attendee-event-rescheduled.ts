import { workflow } from "@novu/framework";

import { eventRescheduledForAttendeeEmail } from "@/adapters/outbound/notification-content/attendee-event-changed";

export const EVENT_RESCHEDULED_FOR_ATTENDEE_WORKFLOW_ID = "attendee-event-rescheduled";

/**
 * The email every Registered attendee gets when the event is rescheduled
 * (SPM-69). Email only: an Attendee has no account, so no Inbox.
 */
export const eventRescheduledForAttendee = workflow(
  EVENT_RESCHEDULED_FOR_ATTENDEE_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.email("email", async () => eventRescheduledForAttendeeEmail(payload, payload.registrationUrl));
  },
  {
    name: "Event rescheduled (attendee)",
    // An Attendee must not turn up at the old time.
    preferences: { all: { enabled: true, readOnly: true } },
    tags: [EVENT_RESCHEDULED_FOR_ATTENDEE_WORKFLOW_ID],
    // Mirrors `EventRescheduledForAttendeeNotice`, plus the link the notifier builds.
    payloadSchema: {
      type: "object",
      properties: {
        registrationId: { type: "string" },
        recipientEmail: { type: "string" },
        attendeeName: { type: "string" },
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
        venueName: { type: ["string", "null"] },
        registrationUrl: { type: "string" },
      },
      required: ["registrationId", "recipientEmail", "attendeeName", "eventName", "times", "venueName", "registrationUrl"],
      additionalProperties: false,
    } as const,
  },
);
