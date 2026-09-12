import { describe, expect, it } from "vitest";

import { InMemoryEventCatalogue } from "@/adapters/outbound/in-memory/in-memory-event-catalogue";
import { InMemoryRegistrationRepository } from "@/adapters/outbound/in-memory/in-memory-registration-repository";
import { FixedClock } from "@/adapters/outbound/in-memory/fixed-clock";
import { attendeeEmail, attendeeName } from "@/core/domain/attendee";
import { eventId, type Event } from "@/core/domain/event";
import {
  EventAlreadyCompletedError,
  EventNotFoundError,
  RegistrationAlreadyWithdrawnError,
  RegistrationNotFoundError,
} from "@/core/domain/errors";
import { registrationId, type Registration } from "@/core/domain/registration";

import { RegisterForEventUseCase } from "@/features/registration/register-for-event";
import { WithdrawRegistrationUseCase } from "./withdraw-registration";

const NOW = new Date("2026-09-07T02:00:00.000Z"); // 10:00 in Singapore.
const SUMMIT = "1";
const WORKSHOP = "2";
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
): { useCase: WithdrawRegistrationUseCase; registrations: InMemoryRegistrationRepository } {
  const events = new InMemoryEventCatalogue(options.events ?? [event(SUMMIT), event(WORKSHOP)]);
  const registrations = new InMemoryRegistrationRepository(
    options.registrations ?? [registration()],
  );

  return { useCase: new WithdrawRegistrationUseCase({ registrations, events }), registrations };
}

describe("WithdrawRegistrationUseCase", () => {
  it("withdraws a live registration", async () => {
    const { useCase, registrations } = buildUseCase();

    await useCase.execute({ reference: REFERENCE });

    expect(registrations.all()[0]).toMatchObject({ status: "withdrawn" });
  });

  it("changes only the status, leaving the attendee and registeredAt untouched", async () => {
    const before = registration();
    const { useCase, registrations } = buildUseCase({ registrations: [before] });

    await useCase.execute({ reference: REFERENCE });

    expect(registrations.all()[0]).toEqual({ ...before, status: "withdrawn" });
  });

  it("refuses a reference that names no registration", async () => {
    const { useCase } = buildUseCase();

    await expect(useCase.execute({ reference: "no-such-reference" })).rejects.toBeInstanceOf(
      RegistrationNotFoundError,
    );
  });

  it("rejects a blank reference before touching any infrastructure", async () => {
    const { useCase, registrations } = buildUseCase();

    await expect(useCase.execute({ reference: "   " })).rejects.toThrow(
      /not a usable registration id/,
    );
    expect(registrations.all()).toEqual([registration()]);
  });

  it("refuses when the event the registration points at cannot be found", async () => {
    const { useCase } = buildUseCase({ events: [event(WORKSHOP)] });

    await expect(useCase.execute({ reference: REFERENCE })).rejects.toBeInstanceOf(
      EventNotFoundError,
    );
  });

  describe("the terminal state (SPM-84)", () => {
    it("refuses a registration that has already been withdrawn", async () => {
      const { useCase } = buildUseCase({
        registrations: [registration({ status: "withdrawn" })],
      });

      await expect(useCase.execute({ reference: REFERENCE })).rejects.toBeInstanceOf(
        RegistrationAlreadyWithdrawnError,
      );
    });

    it("writes nothing when it refuses", async () => {
      const withdrawn = registration({ status: "withdrawn" });
      const { useCase, registrations } = buildUseCase({ registrations: [withdrawn] });

      await expect(useCase.execute({ reference: REFERENCE })).rejects.toThrow();

      expect(registrations.all()).toEqual([withdrawn]);
    });

    it("reports an already-withdrawn registration as such even once the event has completed", async () => {
      const { useCase } = buildUseCase({
        events: [event(SUMMIT, { status: "completed" })],
        registrations: [registration({ status: "withdrawn" })],
      });

      await expect(useCase.execute({ reference: REFERENCE })).rejects.toBeInstanceOf(
        RegistrationAlreadyWithdrawnError,
      );
    });
  });

  describe("the cut-off (SPM-84)", () => {
    it("refuses to withdraw once the event has completed", async () => {
      const { useCase, registrations } = buildUseCase({
        events: [event(SUMMIT, { status: "completed" })],
      });

      await expect(useCase.execute({ reference: REFERENCE })).rejects.toBeInstanceOf(
        EventAlreadyCompletedError,
      );
      expect(registrations.all()).toEqual([registration()]);
    });

    it("allows withdrawal after the event has started but before it is completed", async () => {
      const started = event(SUMMIT, {
        startsAt: new Date("2026-09-06T01:00:00.000Z"),
        endsAt: new Date("2026-09-06T09:00:00.000Z"),
      });
      const { useCase, registrations } = buildUseCase({ events: [started] });

      await useCase.execute({ reference: REFERENCE });

      expect(registrations.all()[0]).toMatchObject({ status: "withdrawn" });
    });

    it("allows withdrawal after the registration period has closed", async () => {
      const closed = event(SUMMIT, {
        registrationClosesAt: new Date("2026-09-06T00:00:00.000Z"),
      });
      const { useCase, registrations } = buildUseCase({ events: [closed] });

      await useCase.execute({ reference: REFERENCE });

      expect(registrations.all()[0]).toMatchObject({ status: "withdrawn" });
    });

    it("allows withdrawal from an event whose registration has been disabled", async () => {
      const disabled = event(SUMMIT, { registrationEnabled: false });
      const { useCase, registrations } = buildUseCase({ events: [disabled] });

      await useCase.execute({ reference: REFERENCE });

      expect(registrations.all()[0]).toMatchObject({ status: "withdrawn" });
    });
  });

  describe("the freed place (SPM-85)", () => {
    it("frees the place, so the event's places taken falls by one", async () => {
      const { useCase, registrations } = buildUseCase();
      expect(await registrations.placesTaken(eventId(SUMMIT))).toBe(1);

      await useCase.execute({ reference: REFERENCE });

      expect(await registrations.placesTaken(eventId(SUMMIT))).toBe(0);
    });

    it("does not free a place at any other event", async () => {
      const other = registration({
        id: registrationId("reference-2"),
        eventId: eventId(WORKSHOP),
        attendeeEmail: attendeeEmail("grace@example.com"),
      });
      const { useCase, registrations } = buildUseCase({
        registrations: [registration(), other],
      });

      await useCase.execute({ reference: REFERENCE });

      expect(await registrations.placesTaken(eventId(WORKSHOP))).toBe(1);
    });

    it("lets a new attendee take the place a withdrawal freed at a full event", async () => {
      const full = event(SUMMIT, { capacity: 1 });
      const events = new InMemoryEventCatalogue([full]);
      const registrations = new InMemoryRegistrationRepository([registration()]);
      const withdraw = new WithdrawRegistrationUseCase({ registrations, events });
      const register = new RegisterForEventUseCase({
        events,
        registrations,
        clock: new FixedClock(NOW),
      });

      // The event is full, so a new attendee is refused.
      await expect(
        register.execute({ eventId: SUMMIT, fullName: "Grace Hopper", email: "grace@example.com" }),
      ).rejects.toThrow(/full/);

      await withdraw.execute({ reference: REFERENCE });

      await expect(
        register.execute({ eventId: SUMMIT, fullName: "Grace Hopper", email: "grace@example.com" }),
      ).resolves.toMatchObject({ event: { id: SUMMIT } });
    });

    it("lets the same attendee register again after withdrawing", async () => {
      const events = new InMemoryEventCatalogue([event(SUMMIT)]);
      const registrations = new InMemoryRegistrationRepository([registration()]);
      const withdraw = new WithdrawRegistrationUseCase({ registrations, events });
      const register = new RegisterForEventUseCase({
        events,
        registrations,
        clock: new FixedClock(NOW),
      });

      await withdraw.execute({ reference: REFERENCE });

      await expect(
        register.execute({ eventId: SUMMIT, fullName: "Ada Lovelace", email: "ada@example.com" }),
      ).resolves.toMatchObject({ event: { id: SUMMIT } });
    });
  });

  describe("the confirmation (SPM-86)", () => {
    it("names the event the place was released for", async () => {
      const { useCase } = buildUseCase();

      const { registration: result } = await useCase.execute({ reference: REFERENCE });

      expect(result.event).toMatchObject({
        id: SUMMIT,
        name: "Event 1",
        startsAt: "2026-10-01T01:00:00.000Z",
        endsAt: "2026-10-01T09:00:00.000Z",
        venueName: "Hall A, 60 Stamford Road",
      });
    });

    it("reports the registration as withdrawn and no longer withdrawable", async () => {
      const { useCase } = buildUseCase();

      const { registration: result } = await useCase.execute({ reference: REFERENCE });

      expect(result).toMatchObject({
        reference: REFERENCE,
        attendeeName: "Ada Lovelace",
        status: "withdrawn",
        canWithdraw: false,
      });
    });
  });
});
