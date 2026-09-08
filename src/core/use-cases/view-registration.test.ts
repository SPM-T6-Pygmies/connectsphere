import { describe, expect, it } from "vitest";

import { InMemoryEventCatalogue } from "@/adapters/outbound/in-memory/in-memory-event-catalogue";
import { InMemoryRegistrationRepository } from "@/adapters/outbound/in-memory/in-memory-registration-repository";
import { attendeeEmail, attendeeName } from "@/core/domain/attendee";
import { eventId, type Event } from "@/core/domain/event";
import { EventNotFoundError, RegistrationNotFoundError } from "@/core/domain/errors";
import { registrationId, type Registration } from "@/core/domain/registration";

import { ViewRegistrationUseCase } from "./view-registration";

const SUMMIT = "1";
const REFERENCE = "reference-1";

function event(id: string, overrides: Partial<Event> = {}): Event {
  return {
    id: eventId(id),
    name: `Event ${id}`,
    description: null,
    status: "confirmed",
    startsAt: new Date("2026-10-01T01:00:00.000Z"),
    endsAt: new Date("2026-10-01T09:00:00.000Z"),
    venueName: "Hall A, 60 Stamford Road",
    capacity: null,
    registrationEnabled: true,
    registrationOpensAt: new Date("2026-09-01T00:00:00.000Z"),
    registrationClosesAt: new Date("2026-09-30T00:00:00.000Z"),
    ...overrides,
  };
}

function registration(overrides: Partial<Registration> = {}): Registration {
  return {
    id: registrationId(REFERENCE),
    eventId: eventId(SUMMIT),
    attendeeName: attendeeName("Ada Lovelace"),
    attendeeEmail: attendeeEmail("ada@example.com"),
    status: "registered",
    registeredAt: new Date("2026-09-05T02:00:00.000Z"),
    ...overrides,
  };
}

function buildUseCase(
  options: { events?: Event[]; registrations?: Registration[] } = {},
): ViewRegistrationUseCase {
  return new ViewRegistrationUseCase({
    events: new InMemoryEventCatalogue(options.events ?? [event(SUMMIT)]),
    registrations: new InMemoryRegistrationRepository(options.registrations ?? [registration()]),
  });
}

describe("ViewRegistrationUseCase", () => {
  it("returns the registration and the event it is for", async () => {
    const useCase = buildUseCase();

    const { registration: result } = await useCase.execute({ reference: REFERENCE });

    expect(result).toMatchObject({
      reference: REFERENCE,
      attendeeName: "Ada Lovelace",
      attendeeEmail: "ada@example.com",
      status: "registered",
      registeredAt: "2026-09-05T02:00:00.000Z",
      event: { id: SUMMIT, name: "Event 1", venueName: "Hall A, 60 Stamford Road" },
    });
  });

  it("offers withdrawal for a live registration on an event still to come", async () => {
    const useCase = buildUseCase();

    const { registration: result } = await useCase.execute({ reference: REFERENCE });

    expect(result.canWithdraw).toBe(true);
  });

  it("still offers withdrawal once the registration period has closed", async () => {
    const useCase = buildUseCase({
      events: [event(SUMMIT, { registrationClosesAt: new Date("2026-09-02T00:00:00.000Z") })],
    });

    const { registration: result } = await useCase.execute({ reference: REFERENCE });

    expect(result.canWithdraw).toBe(true);
  });

  it("returns a withdrawn registration rather than refusing it", async () => {
    const useCase = buildUseCase({ registrations: [registration({ status: "withdrawn" })] });

    const { registration: result } = await useCase.execute({ reference: REFERENCE });

    expect(result).toMatchObject({ status: "withdrawn", canWithdraw: false });
  });

  it("does not offer withdrawal once the event has completed", async () => {
    const useCase = buildUseCase({ events: [event(SUMMIT, { status: "completed" })] });

    const { registration: result } = await useCase.execute({ reference: REFERENCE });

    expect(result).toMatchObject({ status: "registered", canWithdraw: false });
  });

  it("still names a completed event, so the page can say why it refuses", async () => {
    const useCase = buildUseCase({ events: [event(SUMMIT, { status: "completed" })] });

    const { registration: result } = await useCase.execute({ reference: REFERENCE });

    expect(result.event.name).toBe("Event 1");
  });

  it("refuses a reference that names no registration", async () => {
    const useCase = buildUseCase();

    await expect(useCase.execute({ reference: "no-such-reference" })).rejects.toBeInstanceOf(
      RegistrationNotFoundError,
    );
  });

  it("refuses when the event the registration points at cannot be found", async () => {
    const useCase = buildUseCase({ events: [] });

    await expect(useCase.execute({ reference: REFERENCE })).rejects.toBeInstanceOf(
      EventNotFoundError,
    );
  });

  it("rejects a blank reference before touching any infrastructure", async () => {
    const useCase = buildUseCase();

    await expect(useCase.execute({ reference: "   " })).rejects.toThrow(
      /not a usable registration id/,
    );
  });
});
