import { describe, expect, it } from "vitest";

import { InMemoryRegistrationRepository } from "@/adapters/outbound/in-memory/in-memory-registration-repository";
import { RecordingNotifier } from "@/adapters/outbound/in-memory/recording-notifier";
import { attendeeEmail, attendeeName } from "@/core/domain/attendee";
import { eventId } from "@/core/domain/event";
import { registerAttendee, registrationId, type Registration } from "@/core/domain/registration";

import { AttendeeChangeAnnouncer } from "./announce-event-change-to-attendees";

const EVENT = eventId("event-1");

function registration(id: string, overrides: Partial<Registration> = {}): Registration {
  return {
    ...registerAttendee({
      id: registrationId(id),
      eventId: EVENT,
      attendeeName: attendeeName(`Attendee ${id}`),
      attendeeEmail: attendeeEmail(`${id}@example.com`),
      registeredAt: new Date("2026-10-20T02:00:00Z"),
    }),
    ...overrides,
  };
}

const rescheduled = {
  kind: "rescheduled",
  times: [{ date: "2026-12-03", start: "10:00", end: "15:00" }],
  venueName: "Studio",
} as const;

describe("AttendeeChangeAnnouncer (SPM-69)", () => {
  it("AC1, AC2: emails each Registered attendee the new times and venue, and no withdrawn one", async () => {
    const registrations = new InMemoryRegistrationRepository([
      registration("a"),
      registration("b"),
      registration("c"),
      registration("d", { status: "withdrawn" }),
      registration("e", { eventId: eventId("event-2") }),
    ]);
    const notifier = new RecordingNotifier();

    const result = await new AttendeeChangeAnnouncer({ registrations, notifier }).announce(
      EVENT,
      "Marina Bay Gala",
      rescheduled,
    );

    expect(result).toEqual({ sent: 3, failed: 0 });
    expect(notifier.attendeesToldRescheduled.map((notice) => notice.recipientEmail)).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
    ]);
    expect(notifier.attendeesToldRescheduled[0]).toEqual({
      registrationId: "a",
      recipientEmail: "a@example.com",
      attendeeName: "Attendee a",
      eventName: "Marina Bay Gala",
      times: rescheduled.times,
      venueName: "Studio",
    });
  });

  it("AC1: one email that fails does not stop the rest", async () => {
    const registrations = new InMemoryRegistrationRepository([registration("a"), registration("b"), registration("c")]);
    const sentTo: string[] = [];
    const notifier = {
      eventRescheduledForAttendee: async () => {},
      eventCancelledForAttendee: async ({ recipientEmail }: { recipientEmail: string }) => {
        if (recipientEmail === "b@example.com") {
          throw new Error("Novu is down");
        }
        sentTo.push(recipientEmail);
      },
    };

    const result = await new AttendeeChangeAnnouncer({ registrations, notifier }).announce(
      EVENT,
      "Marina Bay Gala",
      { kind: "cancelled" },
    );

    expect(result).toEqual({ sent: 2, failed: 1 });
    expect(sentTo).toEqual(["a@example.com", "c@example.com"]);
  });

  it("AC1: an event with no registrations emails nobody", async () => {
    const notifier = new RecordingNotifier();

    const result = await new AttendeeChangeAnnouncer({
      registrations: new InMemoryRegistrationRepository(),
      notifier,
    }).announce(EVENT, "Marina Bay Gala", { kind: "cancelled" });

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(notifier.attendeesToldCancelled).toEqual([]);
  });
});
