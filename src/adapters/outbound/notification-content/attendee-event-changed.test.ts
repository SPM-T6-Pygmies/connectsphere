import { describe, expect, it } from "vitest";

import type { EventRescheduledForAttendeeNotice } from "@/core/ports/outbound/notifier";

import { eventCancelledForAttendeeEmail, eventRescheduledForAttendeeEmail } from "./attendee-event-changed";

const URL = "https://connectsphere.test/registrations/3f0c2a6e";

function rescheduled(overrides: Partial<EventRescheduledForAttendeeNotice> = {}): EventRescheduledForAttendeeNotice {
  return {
    registrationId: "3f0c2a6e",
    recipientEmail: "mei@example.com",
    attendeeName: "Mei Lin",
    eventName: "Marina Bay Gala",
    times: [{ date: "2026-12-03", start: "10:00", end: "15:00" }],
    venueName: "Studio",
    ...overrides,
  };
}

describe("eventRescheduledForAttendeeEmail (SPM-69)", () => {
  it("AC2: carries the new date, time and venue, and the link to check or withdraw", () => {
    expect(eventRescheduledForAttendeeEmail(rescheduled(), URL)).toEqual({
      subject: "Rescheduled: Marina Bay Gala",
      body: [
        "<p>Hi Mei Lin,</p>",
        "<p><strong>Marina Bay Gala</strong> has been rescheduled. Your registration still stands.</p>",
        "<p>",
        "Date: Thursday, 3 December 2026<br>",
        "Time: 10:00 am – 3:00 pm (GMT+8)<br>",
        "Venue: Studio",
        "</p>",
        "<p>Use this link to check or withdraw your registration:<br>",
        `<a href="${URL}">${URL}</a></p>`,
      ].join("\n"),
    });
  });

  it("AC2: says the venue is to be confirmed when none is", () => {
    expect(eventRescheduledForAttendeeEmail(rescheduled({ venueName: null }), URL).body).toContain(
      "Venue: Venue to be confirmed",
    );
  });

  it("AC3: escapes what people typed, so an event name cannot inject markup", () => {
    const { body } = eventRescheduledForAttendeeEmail(rescheduled({ eventName: "<b>Gala</b>" }), URL);

    expect(body).toContain("&lt;b&gt;Gala&lt;/b&gt;");
  });
});

describe("eventCancelledForAttendeeEmail (SPM-69)", () => {
  it("AC1, AC3: says the event is cancelled, with the link and nothing internal", () => {
    const { subject, body } = eventCancelledForAttendeeEmail(
      { registrationId: "3f0c2a6e", recipientEmail: "mei@example.com", attendeeName: "Mei Lin", eventName: "Marina Bay Gala" },
      URL,
    );

    expect(subject).toBe("Cancelled: Marina Bay Gala");
    expect(body).toBe(
      [
        "<p>Hi Mei Lin,</p>",
        "<p>We're sorry: <strong>Marina Bay Gala</strong> has been cancelled and will not take place.</p>",
        "<p>Use this link to check or withdraw your registration:<br>",
        `<a href="${URL}">${URL}</a></p>`,
      ].join("\n"),
    );
  });
});
