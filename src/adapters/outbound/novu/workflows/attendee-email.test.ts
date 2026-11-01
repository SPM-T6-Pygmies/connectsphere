import { describe, expect, it } from "vitest";

import { eventCancelledForAttendeeEmail, eventRescheduledForAttendeeEmail } from "@/adapters/outbound/notification-content/attendee-event-changed";
import { registrationConfirmedEmail } from "@/adapters/outbound/notification-content/registration-confirmed";

import { attendeeEmail, attendeeEmailMessage } from "./attendee-email";

const url = "https://connectsphere.example/registrations/r1";
const attendee = {
  registrationId: "r1",
  recipientEmail: "ada@example.com",
  attendeeName: "Ada Lovelace",
  eventName: "Pygmies Product Summit",
  registrationUrl: url,
};
const times = [{ date: "2026-10-01", start: "07:00", end: "12:00" }];

describe("attendeeEmail (SPM-305)", () => {
  it("cannot be switched off, since its link is the attendee's only way back", async () => {
    const definition = await attendeeEmail.discover();

    expect(definition.preferences).toEqual({ all: { enabled: true, readOnly: true } });
  });

  it("sends an email and nothing else, since an attendee has no Inbox", async () => {
    const definition = await attendeeEmail.discover();

    expect(definition.steps.map((step) => step.type)).toEqual(["email"]);
  });

  it("confirms a registration in the registration email's own words", () => {
    const notice = { ...attendee, startsAt: "2026-09-30T23:00:00.000Z", times, venueName: "Studio" };

    expect(attendeeEmailMessage({ kind: "registration-confirmed", ...notice })).toEqual(registrationConfirmedEmail(notice, url));
  });
});

describe("attendeeEmail (SPM-69)", () => {
  it("AC2: announces a reschedule in the reschedule email's own words", () => {
    const notice = { ...attendee, times, venueName: null };

    expect(attendeeEmailMessage({ kind: "rescheduled", ...notice })).toEqual(eventRescheduledForAttendeeEmail(notice, url));
  });

  it("AC1: announces a cancellation in the cancellation email's own words", () => {
    expect(attendeeEmailMessage({ kind: "cancelled", ...attendee })).toEqual(eventCancelledForAttendeeEmail(attendee, url));
  });
});
