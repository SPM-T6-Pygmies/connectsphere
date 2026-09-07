import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryEventCatalogue } from "@/adapters/outbound/in-memory/in-memory-event-catalogue";
import { InMemoryRegistrationRepository } from "@/adapters/outbound/in-memory/in-memory-registration-repository";
import { attendeeEmail, attendeeName } from "@/core/domain/attendee";
import { eventId, type Event } from "@/core/domain/event";
import {
  DuplicateRegistrationError,
  EventFullError,
  EventNotFoundError,
  EventNotOpenForRegistrationError,
} from "@/core/domain/errors";
import { registrationId, type Registration } from "@/core/domain/registration";

import { RegisterForEventUseCase } from "./register-for-event";

const NOW = new Date("2026-09-07T02:00:00.000Z"); // 10:00 in Singapore.
const SUMMIT = "summit";
const WORKSHOP = "workshop";
const ADA = { fullName: "Ada Lovelace", email: "ada@example.com" };

function event(id: string, overrides: Partial<Event> = {}): Event {
  return {
    id: eventId(id),
    name: "Pygmies Product Summit",
    description: "A day of talks.",
    status: "confirmed",
    startsAt: new Date("2026-10-01T01:00:00.000Z"),
    endsAt: new Date("2026-10-01T09:00:00.000Z"),
    venueName: "Hall A, 81 Victoria Street",
    capacity: 2,
    registrationEnabled: true,
    registrationOpensAt: new Date("2026-09-01T00:00:00.000Z"),
    registrationClosesAt: new Date("2026-09-30T00:00:00.000Z"),
    ...overrides,
  };
}

function existingRegistration(
  overrides: Partial<Registration> = {},
): Registration {
  return {
    id: registrationId("registration-existing"),
    eventId: eventId(SUMMIT),
    attendeeName: attendeeName("Ada Lovelace"),
    attendeeEmail: attendeeEmail("ada@example.com"),
    status: "registered",
    registeredAt: new Date("2026-09-02T00:00:00.000Z"),
    ...overrides,
  };
}

function buildUseCase(
  options: { events?: Event[]; registrations?: Registration[] } = {},
) {
  const registrations = new InMemoryRegistrationRepository(
    options.registrations ?? [],
  );
  const useCase = new RegisterForEventUseCase({
    events: new InMemoryEventCatalogue(options.events ?? [event(SUMMIT)]),
    registrations,
    clock: new FixedClock(NOW),
  });
  return { useCase, registrations };
}

describe("RegisterForEventUseCase", () => {
  it("records a registration and returns the event name, date, time and venue", async () => {
    const { useCase } = buildUseCase();

    const result = await useCase.execute({ eventId: SUMMIT, ...ADA });

    expect(result.registrationId).toBe("registration-1");
    expect(result.registeredAt).toBe("2026-09-07T02:00:00.000Z");
    expect(result.event).toMatchObject({
      name: "Pygmies Product Summit",
      startsAt: "2026-10-01T01:00:00.000Z",
      endsAt: "2026-10-01T09:00:00.000Z",
      venueName: "Hall A, 81 Victoria Street",
    });
  });

  it("stores the attendee's name and a normalised, lower-cased email", async () => {
    const { useCase, registrations } = buildUseCase();

    await useCase.execute({
      eventId: SUMMIT,
      fullName: "  Ada Lovelace  ",
      email: "  ADA@Example.com ",
    });

    expect(registrations.all()).toEqual([
      {
        id: "registration-1",
        eventId: SUMMIT,
        attendeeName: "Ada Lovelace",
        attendeeEmail: "ada@example.com",
        status: "registered",
        registeredAt: NOW,
      },
    ]);
  });

  it("rejects registration for an unknown event", async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({ eventId: "nope", ...ADA }),
    ).rejects.toBeInstanceOf(EventNotFoundError);
  });

  it("rejects registration when the event is not confirmed", async () => {
    const { useCase } = buildUseCase({
      events: [event(SUMMIT, { status: "approved" })],
    });

    await expect(
      useCase.execute({ eventId: SUMMIT, ...ADA }),
    ).rejects.toBeInstanceOf(EventNotOpenForRegistrationError);
  });

  it("rejects registration when registration is disabled", async () => {
    const { useCase } = buildUseCase({
      events: [event(SUMMIT, { registrationEnabled: false })],
    });

    await expect(
      useCase.execute({ eventId: SUMMIT, ...ADA }),
    ).rejects.toBeInstanceOf(EventNotOpenForRegistrationError);
  });

  it("rejects registration before the window opens", async () => {
    const notYet = event(SUMMIT, {
      registrationOpensAt: new Date("2026-09-08T00:00:00.000Z"),
    });
    const { useCase } = buildUseCase({ events: [notYet] });

    await expect(
      useCase.execute({ eventId: SUMMIT, ...ADA }),
    ).rejects.toBeInstanceOf(EventNotOpenForRegistrationError);
  });

  it("rejects registration after the window closes", async () => {
    const over = event(SUMMIT, {
      registrationClosesAt: new Date("2026-09-06T00:00:00.000Z"),
    });
    const { useCase } = buildUseCase({ events: [over] });

    await expect(
      useCase.execute({ eventId: SUMMIT, ...ADA }),
    ).rejects.toBeInstanceOf(EventNotOpenForRegistrationError);
  });

  it("refuses with EventFullError when places taken equals capacity", async () => {
    const { useCase } = buildUseCase({
      registrations: [
        existingRegistration({
          id: registrationId("r1"),
          attendeeEmail: attendeeEmail("a@x.com"),
        }),
        existingRegistration({
          id: registrationId("r2"),
          attendeeEmail: attendeeEmail("b@x.com"),
        }),
      ],
    });

    await expect(
      useCase.execute({ eventId: SUMMIT, ...ADA }),
    ).rejects.toBeInstanceOf(EventFullError);
  });

  it("accepts the last place when places taken is one below capacity", async () => {
    const { useCase } = buildUseCase({
      registrations: [
        existingRegistration({
          id: registrationId("r1"),
          attendeeEmail: attendeeEmail("a@x.com"),
        }),
      ],
    });

    await expect(
      useCase.execute({ eventId: SUMMIT, ...ADA }),
    ).resolves.toMatchObject({
      registrationId: "registration-1",
    });
  });

  it("treats an event with no capacity set as unlimited", async () => {
    const { useCase } = buildUseCase({
      events: [event(SUMMIT, { capacity: null })],
      registrations: [
        existingRegistration({
          id: registrationId("r1"),
          attendeeEmail: attendeeEmail("a@x.com"),
        }),
        existingRegistration({
          id: registrationId("r2"),
          attendeeEmail: attendeeEmail("b@x.com"),
        }),
        existingRegistration({
          id: registrationId("r3"),
          attendeeEmail: attendeeEmail("c@x.com"),
        }),
      ],
    });

    await expect(
      useCase.execute({ eventId: SUMMIT, ...ADA }),
    ).resolves.toMatchObject({
      registrationId: "registration-1",
    });
  });

  it("rejects a second registration with the same email for the same event", async () => {
    const { useCase } = buildUseCase({
      registrations: [existingRegistration()],
    });

    await expect(
      useCase.execute({ eventId: SUMMIT, ...ADA }),
    ).rejects.toBeInstanceOf(DuplicateRegistrationError);
  });

  it("matches a duplicate regardless of email case and surrounding whitespace", async () => {
    const { useCase } = buildUseCase({
      registrations: [existingRegistration()],
    });

    await expect(
      useCase.execute({
        eventId: SUMMIT,
        fullName: "Ada L",
        email: " Ada@EXAMPLE.com ",
      }),
    ).rejects.toBeInstanceOf(DuplicateRegistrationError);
  });

  it("does not count a withdrawn registration as a duplicate or as a place taken", async () => {
    const { useCase } = buildUseCase({
      registrations: [
        existingRegistration({ status: "withdrawn" }),
        existingRegistration({
          id: registrationId("r2"),
          attendeeEmail: attendeeEmail("b@x.com"),
          status: "withdrawn",
        }),
      ],
    });

    await expect(
      useCase.execute({ eventId: SUMMIT, ...ADA }),
    ).resolves.toMatchObject({
      registrationId: "registration-1",
    });
  });

  it("allows the same email to register for a different event", async () => {
    const { useCase } = buildUseCase({
      events: [event(SUMMIT), event(WORKSHOP)],
      registrations: [existingRegistration()],
    });

    await expect(
      useCase.execute({ eventId: WORKSHOP, ...ADA }),
    ).resolves.toMatchObject({
      registrationId: "registration-1",
    });
  });

  it("writes nothing when a rule refuses", async () => {
    const { useCase, registrations } = buildUseCase({
      events: [event(SUMMIT, { registrationEnabled: false })],
    });

    await expect(
      useCase.execute({ eventId: SUMMIT, ...ADA }),
    ).rejects.toThrow();
    expect(registrations.all()).toEqual([]);
  });

  it.each([
    [
      "a blank full name",
      { fullName: "   ", email: "ada@example.com" },
      /needs the attendee's full name/,
    ],
    [
      "a blank email",
      { fullName: "Ada", email: "  " },
      /needs the attendee's email address/,
    ],
  ])(
    "rejects %s before touching any infrastructure",
    async (_label, fields, message) => {
      const { useCase, registrations } = buildUseCase();

      await expect(
        useCase.execute({ eventId: SUMMIT, ...fields }),
      ).rejects.toThrow(message);
      expect(registrations.all()).toEqual([]);
    },
  );
});
