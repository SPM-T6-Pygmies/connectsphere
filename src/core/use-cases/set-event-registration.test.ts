import { describe, expect, it } from "vitest";

import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import {
  CoordinatorEventNotFoundError,
  EventRegistrationLockedError,
  InvalidRegistrationSettingsError,
} from "@/core/domain/errors";
import { userAccountId } from "@/core/domain/user-account";

import { SetEventRegistrationUseCase } from "./set-event-registration";

const COORDINATOR = "coordinator-1";
const WINDOW = { opensOn: "2026-11-01", closesOn: "2026-11-18" };

function event(overrides: Partial<SeedCoordinatorEvent> = {}): SeedCoordinatorEvent {
  return {
    id: "event-1",
    eventRequestId: "request-1",
    name: "Annual Conference",
    clientOrganisationName: "Acme",
    preferredDate: "2026-11-20",
    status: "Confirmed",
    assignedCoordinatorUserAccountId: COORDINATOR,
    description: null,
    expectedAttendance: 100,
    clientOrganisationId: "org-1",
    owningOrganiserUserAccountId: "organiser-1",
    ...overrides,
  };
}

function build(seed: SeedCoordinatorEvent = event()) {
  const events = new InMemoryCoordinatorEventRepository([seed]);
  return { events, useCase: new SetEventRegistrationUseCase({ events }) };
}

const stored = async (events: InMemoryCoordinatorEventRepository) => {
  const found = await events.findAssigned(userAccountId(COORDINATOR), "event-1");
  return {
    enabled: found?.registrationEnabled,
    opensOn: found?.registrationOpensOn,
    closesOn: found?.registrationClosesOn,
  };
};

describe("SetEventRegistrationUseCase (SPM-25)", () => {
  it("AC1: enables registration with its window", async () => {
    const { events, useCase } = build();

    const result = await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      settings: { enabled: true, ...WINDOW },
    });

    expect(result).toEqual({ settings: { enabled: true, ...WINDOW }, changed: true });
    expect(await stored(events)).toEqual({ enabled: true, ...WINDOW });
  });

  it("AC1: disables registration, keeping the window", async () => {
    const { events, useCase } = build(
      event({ registrationEnabled: true, registrationOpensOn: WINDOW.opensOn, registrationClosesOn: WINDOW.closesOn }),
    );

    await useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, settings: { enabled: false, ...WINDOW } });

    expect(await stored(events)).toEqual({ enabled: false, ...WINDOW });
  });

  it.each(["Planning", "Blocked"] as const)("AC1: sets registration on a %s event", async (status) => {
    const { events, useCase } = build(event({ status }));

    await useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, settings: { enabled: true, ...WINDOW } });

    expect((await stored(events)).enabled).toBe(true);
  });

  it("AC1: records who changed each setting, with its old and new value", async () => {
    const { events, useCase } = build();

    await useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, settings: { enabled: true, ...WINDOW } });

    expect(events.auditTrail()).toEqual([
      { actorUserAccountId: COORDINATOR, eventId: "event-1", field: "registration_enabled_flag", oldValue: "false", newValue: "true" },
      { actorUserAccountId: COORDINATOR, eventId: "event-1", field: "registration_open_date", oldValue: null, newValue: "2026-11-01" },
      { actorUserAccountId: COORDINATOR, eventId: "event-1", field: "registration_close_date", oldValue: null, newValue: "2026-11-18" },
    ]);
  });

  it.each([
    ["assigned to another coordinator", event({ assignedCoordinatorUserAccountId: "coordinator-2" })],
    ["not assigned to anyone", event({ assignedCoordinatorUserAccountId: null })],
  ])("AC1: answers an event %s as not found (#91), and saves nothing", async (_label, seed) => {
    const { events, useCase } = build(seed);

    await expect(
      useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, settings: { enabled: true, ...WINDOW } }),
    ).rejects.toThrow(CoordinatorEventNotFoundError);
    expect(events.auditTrail()).toEqual([]);
  });

  it("AC1: gives an event that does not exist the same answer", async () => {
    const { useCase } = build();

    await expect(
      useCase.execute({ eventId: "nope", userAccountId: COORDINATOR, settings: { enabled: true, ...WINDOW } }),
    ).rejects.toThrow(CoordinatorEventNotFoundError);
  });

  it.each(["Completed", "Cancelled"] as const)("refuses a %s event and saves nothing", async (status) => {
    const { events, useCase } = build(event({ status }));

    await expect(
      useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, settings: { enabled: true, ...WINDOW } }),
    ).rejects.toThrow(EventRegistrationLockedError);
    expect(await stored(events)).toEqual({ enabled: false, opensOn: null, closesOn: null });
  });

  it("refuses to enable registration without both dates, and saves nothing", async () => {
    const { events, useCase } = build();

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: COORDINATOR,
        settings: { enabled: true, opensOn: "2026-11-01", closesOn: "" },
      }),
    ).rejects.toThrow(InvalidRegistrationSettingsError);
    expect(events.auditTrail()).toEqual([]);
  });

  it("refuses a window that opens after it closes, and saves nothing", async () => {
    const { events, useCase } = build();

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: COORDINATOR,
        settings: { enabled: true, opensOn: "2026-11-19", closesOn: "2026-11-18" },
      }),
    ).rejects.toThrow(InvalidRegistrationSettingsError);
    expect(events.auditTrail()).toEqual([]);
  });

  it("writes nothing when the save matches what is stored", async () => {
    const { events, useCase } = build(
      event({ registrationEnabled: true, registrationOpensOn: WINDOW.opensOn, registrationClosesOn: WINDOW.closesOn }),
    );

    const result = await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      settings: { enabled: true, ...WINDOW },
    });

    expect(result.changed).toBe(false);
    expect(events.auditTrail()).toEqual([]);
  });
});
