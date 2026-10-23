import { workflow } from "@novu/framework";

import { registrationConfirmedEmail } from "@/adapters/outbound/notification-content/registration-confirmed";

export const REGISTRATION_CONFIRMED_WORKFLOW_ID = "registration-confirmed";

/**
 * The email an Attendee gets once registered (SPM-87). Email only: an Attendee
 * has no account, so no Inbox to put it in.
 */
export const registrationConfirmed = workflow(
  REGISTRATION_CONFIRMED_WORKFLOW_ID,
  async ({ step, payload }) => {
    await step.email("email", async () => registrationConfirmedEmail(payload, payload.registrationUrl));
  },
  {
    name: "Registration confirmation",
    // The link in it is the Attendee's only way back to their registration.
    preferences: { all: { enabled: true, readOnly: true } },
    tags: [REGISTRATION_CONFIRMED_WORKFLOW_ID],
    // Mirrors `RegistrationConfirmedNotice`, plus the link the notifier builds.
    payloadSchema: {
      type: "object",
      properties: {
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
      required: [
        "registrationId",
        "recipientEmail",
        "attendeeName",
        "eventName",
        "startsAt",
        "times",
        "venueName",
        "registrationUrl",
      ],
      additionalProperties: false,
    } as const,
  },
);
