import { describe, expect, it } from "vitest";

import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { InMemoryEventCatalogue } from "@/adapters/outbound/in-memory/in-memory-event-catalogue";
import { eventId, type Event } from "@/core/domain/event";
import { EventNotFoundError, EventNotOpenForRegistrationError } from "@/core/domain/errors";

import { ViewEventForRegistrationUseCase } from "./view-event-for-registration";

const NOW = new Date("2026-09-07T02:00:00.000Z"); // 10:00 in Singapore.
const SUMMIT = "summit";

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: eventId(SUMMIT),
    name: "Pygmies Product Summit",
    description: "A day of talks.",
    status: "confirmed",
    startsAt: new Date("2026-10-01T01:00:00.000Z"),
    endsAt: new Date("2026-10-01T09:00:00.000Z"),
    venueName: "Hall A, 81 Victoria Street",
    capacity: 100,
    registrationEnabled: true,
    registrationOpensAt: new Date("2026-09-01T00:00:00.000Z"),
    registrationClosesAt: new Date("2026-09-30T00:00:00.000Z"),
    ...overrides,
  };
}

function buildUseCase(seed: readonly Event[] = [event()]) {
  return new ViewEventForRegistrationUseCase({
    events: new InMemoryEventCatalogue(seed),
    clock: new FixedClock(NOW),
  });
}

describe("ViewEventForRegistrationUseCase", () => {
  it("returns the event's name, date, time and venue when it is open for registration", async () => {
    const result = await buildUseCase().execute({ eventId: SUMMIT });

    expect(result.event).toEqual({
      id: SUMMIT,
      name: "Pygmies Product Summit",
      description: "A day of talks.",
      startsAt: "2026-10-01T01:00:00.000Z",
      endsAt: "2026-10-01T09:00:00.000Z",
      venueName: "Hall A, 81 Victoria Street",
      registrationClosesAt: "2026-09-30T00:00:00.000Z",
    });
  });

  it("rejects an unknown event id", async () => {
    await expect(buildUseCase().execute({ eventId: "nope" })).rejects.toBeInstanceOf(
      EventNotFoundError,
    );
  });

  it("rejects an event that is not confirmed", async () => {
    const useCase = buildUseCase([event({ status: "planning" })]);

    await expect(useCase.execute({ eventId: SUMMIT })).rejects.toBeInstanceOf(
      EventNotOpenForRegistrationError,
    );
  });

  it("rejects an event whose registration is disabled", async () => {
    const useCase = buildUseCase([event({ registrationEnabled: false })]);

    await expect(useCase.execute({ eventId: SUMMIT })).rejects.toBeInstanceOf(
      EventNotOpenForRegistrationError,
    );
  });

  it("rejects an event whose registration window has closed", async () => {
    const closed = event({ registrationClosesAt: new Date("2026-09-06T00:00:00.000Z") });

    await expect(buildUseCase([closed]).execute({ eventId: SUMMIT })).rejects.toBeInstanceOf(
      EventNotOpenForRegistrationError,
    );
  });

  it("rejects a blank event id before touching the catalogue", async () => {
    await expect(buildUseCase().execute({ eventId: "   " })).rejects.toThrow(
      /not a usable event id/,
    );
  });
});
