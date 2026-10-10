import { describe, expect, it } from "vitest";

import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import {
  CoordinatorEventNotFoundError,
  EventDetailsLockedError,
  InvalidEventDetailsError,
} from "@/core/domain/errors";
import type { OrdinaryEventDetails } from "@/core/domain/event-details-edit";
import { userAccountId } from "@/core/domain/user-account";

import { UpdateEventDetailsUseCase } from "./update-event-details";

const COORDINATOR = "coordinator-1";

function event(overrides: Partial<SeedCoordinatorEvent> = {}): SeedCoordinatorEvent {
  return {
    id: "event-1",
    eventRequestId: "request-1",
    name: "Annual Conference",
    clientOrganisationName: "Acme",
    preferredDate: "2026-10-05",
    status: "Planning",
    assignedCoordinatorUserAccountId: COORDINATOR,
    description: "Two days of talks.",
    expectedAttendance: 100,
    clientOrganisationId: "org-1",
    owningOrganiserUserAccountId: "organiser-1",
    programmeAgenda: "Keynote, then panels",
    ...overrides,
  };
}

/** The form as it would arrive untouched for the seed above. */
const AS_SEEDED: OrdinaryEventDetails = {
  name: "Annual Conference",
  description: "Two days of talks.",
  purpose: null,
  categoryType: null,
  programmeAgenda: "Keynote, then panels",
  specialArrangements: null,
  accessibilityRequirements: null,
  operationalNotes: null,
};

function build(seed: SeedCoordinatorEvent = event()) {
  const events = new InMemoryCoordinatorEventRepository([seed]);
  return { events, useCase: new UpdateEventDetailsUseCase({ events }) };
}

const stored = (events: InMemoryCoordinatorEventRepository) =>
  events.findAssigned(userAccountId(COORDINATOR), "event-1");

describe("UpdateEventDetailsUseCase (SPM-49)", () => {
  it("AC1: saves the ordinary details the coordinator changed", async () => {
    const { events, useCase } = build();

    const result = await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      details: { ...AS_SEEDED, name: "Annual Summit", operationalNotes: "Load-in at 7am" },
    });

    expect(result.changed).toEqual(["name", "operationalNotes"]);
    expect(await stored(events)).toMatchObject({
      name: "Annual Summit",
      operationalNotes: "Load-in at 7am",
      description: "Two days of talks.",
    });
  });

  it.each(["Blocked", "Confirmed"] as const)("AC1: edits a %s event", async (status) => {
    const { events, useCase } = build(event({ status }));

    await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      details: { ...AS_SEEDED, purpose: "Team alignment" },
    });

    expect((await stored(events))?.purpose).toBe("Team alignment");
  });

  it("AC1: lets the coordinator clear the programme agenda of a Confirmed event", async () => {
    const { events, useCase } = build(event({ status: "Confirmed" }));

    await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      details: { ...AS_SEEDED, programmeAgenda: "" },
    });

    expect((await stored(events))?.programmeAgenda).toBeNull();
  });

  it.each(["Completed", "Cancelled"] as const)("AC1: refuses to edit a %s event", async (status) => {
    const { events, useCase } = build(event({ status }));

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: COORDINATOR,
        details: { ...AS_SEEDED, name: "Renamed" },
      }),
    ).rejects.toThrow(EventDetailsLockedError);
    expect((await stored(events))?.name).toBe("Annual Conference");
  });

  it("AC1: refuses a blank name and saves nothing", async () => {
    const { events, useCase } = build();

    await expect(
      useCase.execute({
        eventId: "event-1",
        userAccountId: COORDINATOR,
        details: { ...AS_SEEDED, name: " ", purpose: "Team alignment" },
      }),
    ).rejects.toThrow(InvalidEventDetailsError);
    expect(events.auditTrail()).toEqual([]);
  });

  it.each([
    ["assigned to another coordinator", event({ assignedCoordinatorUserAccountId: "coordinator-2" })],
    ["not assigned to anyone", event({ assignedCoordinatorUserAccountId: null })],
  ])("AC1: answers an event %s as not found (#91)", async (_label, seed) => {
    const { useCase } = build(seed);

    await expect(
      useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, details: AS_SEEDED }),
    ).rejects.toThrow(CoordinatorEventNotFoundError);
  });

  it("AC2: leaves attendance alone even when the edit carries it", async () => {
    const { events, useCase } = build();
    const smuggled = { ...AS_SEEDED, expectedAttendance: 500 } as OrdinaryEventDetails;

    const result = await useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, details: smuggled });

    expect(result.changed).toEqual([]);
    expect((await stored(events))?.expectedAttendance).toBe(100);
  });

  it("AC3: records who changed each field, with its old and new value", async () => {
    const { events, useCase } = build();

    await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      details: { ...AS_SEEDED, name: "Annual Summit", description: null },
    });

    expect(events.auditTrail()).toEqual([
      {
        actorUserAccountId: COORDINATOR,
        eventId: "event-1",
        field: "name",
        oldValue: "Annual Conference",
        newValue: "Annual Summit",
      },
      {
        actorUserAccountId: COORDINATOR,
        eventId: "event-1",
        field: "description",
        oldValue: "Two days of talks.",
        newValue: null,
      },
    ]);
  });

  it("AC3: records nothing when the edit changes nothing", async () => {
    const { events, useCase } = build();

    const result = await useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, details: AS_SEEDED });

    expect(result.changed).toEqual([]);
    expect(events.auditTrail()).toEqual([]);
  });
});
