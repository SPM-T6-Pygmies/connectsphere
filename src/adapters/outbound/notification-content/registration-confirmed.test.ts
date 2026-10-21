import { describe, expect, it } from "vitest";

import type { RegistrationConfirmedNotice } from "@/core/ports/outbound/notifier";

import { registrationConfirmedEmail } from "./registration-confirmed";

const URL = "https://connectsphere.example/registrations/42";

function notice(overrides: Partial<RegistrationConfirmedNotice> = {}): RegistrationConfirmedNotice {
  return {
    registrationId: "42",
    recipientEmail: "ada@example.com",
    attendeeName: "Ada Lovelace",
    eventName: "Pygmies Product Summit",
    startsAt: "2026-09-30T23:00:00.000Z",
    times: [
      { date: "2026-10-01", start: "07:00", end: "12:00" },
      { date: "2026-10-01", start: "13:00", end: "18:00" },
    ],
    venueName: "Hall A, 81 Victoria Street",
    ...overrides,
  };
}

describe("registrationConfirmedEmail (SPM-305)", () => {
  it("names the event in the subject", () => {
    expect(registrationConfirmedEmail(notice(), URL).subject).toBe(
      "You're registered: Pygmies Product Summit",
    );
  });

  it("AC2: gives the event's date, time and venue in Singapore time, as the confirmation does", () => {
    const { body } = registrationConfirmedEmail(notice(), URL);

    expect(body).toContain("Date: Thursday, 1 October 2026");
    expect(body).toContain("Venue: Hall A, 81 Victoria Street");
  });

  it("SPM-326 AC2: gives each start and end time, naming the GMT+8 zone, with no slot labels", () => {
    const { body } = registrationConfirmedEmail(notice(), URL);

    expect(body).toContain("Time: 7:00 am – 12:00 pm, 1:00 pm – 6:00 pm (GMT+8)");
    expect(body).not.toMatch(/\b(AM|PM|Night)\b/);
  });

  it("AC1: links to the registration", () => {
    expect(registrationConfirmedEmail(notice(), URL).body).toContain(`<a href="${URL}">${URL}</a>`);
  });

  it("says the venue is to be confirmed when there is none yet", () => {
    expect(registrationConfirmedEmail(notice({ venueName: null }), URL).body).toContain(
      "Venue: Venue to be confirmed",
    );
  });

  it("SPM-326: names the day before each time of an event on more than one day", () => {
    const { body } = registrationConfirmedEmail(
      notice({
        times: [
          { date: "2026-10-01", start: "19:00", end: "24:00" },
          { date: "2026-10-02", start: "07:00", end: "12:00" },
        ],
      }),
      URL,
    );

    expect(body).toContain("Time: 1 Oct 7:00 pm – 12:00 am, 2 Oct 7:00 am – 12:00 pm (GMT+8)");
  });

  it("escapes names typed by people, since the body is HTML", () => {
    const { body } = registrationConfirmedEmail(
      notice({ eventName: "<script>alert(1)</script>", attendeeName: "Tom & Jerry" }),
      URL,
    );

    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(body).toContain("Hi Tom &amp; Jerry,");
  });
});
