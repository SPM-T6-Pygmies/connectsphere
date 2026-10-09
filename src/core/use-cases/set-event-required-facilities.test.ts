import { describe, expect, it } from "vitest";

import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import {
  CoordinatorEventNotFoundError,
  EventFacilitiesLockedError,
  InvalidEventFacilitiesError,
} from "@/core/domain/errors";
import { userAccountId } from "@/core/domain/user-account";

import { SetEventRequiredFacilitiesUseCase } from "./set-event-required-facilities";

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
    description: null,
    expectedAttendance: 100,
    clientOrganisationId: "org-1",
    owningOrganiserUserAccountId: "organiser-1",
    ...overrides,
  };
}

function build(seed: SeedCoordinatorEvent = event()) {
  const events = new InMemoryCoordinatorEventRepository([seed]);
  return { events, useCase: new SetEventRequiredFacilitiesUseCase({ events }) };
}

const stored = (events: InMemoryCoordinatorEventRepository) =>
  events.findAssigned(userAccountId(COORDINATOR), "event-1").then((found) => found?.requiredFacilities);

describe("SetEventRequiredFacilitiesUseCase (SPM-247)", () => {
  it("saves the facilities ticked, in the list's order", async () => {
    const { events, useCase } = build();
    const result = await useCase.execute({
      eventId: "event-1",
      userAccountId: COORDINATOR,
      facilities: ["Video-conferencing", "Wi-Fi"],
    });
    expect(result.requiredFacilities).toBe("Wi-Fi, Video-conferencing");
    expect(await stored(events)).toBe("Wi-Fi, Video-conferencing");
  });

  it("changes what was saved before", async () => {
    const { events, useCase } = build(event({ requiredFacilities: "Wi-Fi" }));
    await useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, facilities: ["Catering area"] });
    expect(await stored(events)).toBe("Catering area");
  });

  it("clears them when none is ticked", async () => {
    const { events, useCase } = build(event({ requiredFacilities: "Wi-Fi" }));
    await useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, facilities: [] });
    expect(await stored(events)).toBeNull();
  });

  it.each(["Planning", "Blocked", "Confirmed"] as const)("saves on a %s event", async (status) => {
    const { events, useCase } = build(event({ status }));
    await useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, facilities: ["Wi-Fi"] });
    expect(await stored(events)).toBe("Wi-Fi");
  });

  it.each(["Completed", "Cancelled"] as const)("refuses a %s event and saves nothing", async (status) => {
    const { events, useCase } = build(event({ status, requiredFacilities: "Wi-Fi" }));
    await expect(
      useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, facilities: ["Catering area"] }),
    ).rejects.toThrow(EventFacilitiesLockedError);
    expect(await stored(events)).toBe("Wi-Fi");
  });

  it("refuses a facility that is not on the list and saves nothing", async () => {
    const { events, useCase } = build(event({ requiredFacilities: "Wi-Fi" }));
    await expect(
      useCase.execute({ eventId: "event-1", userAccountId: COORDINATOR, facilities: ["Projector"] }),
    ).rejects.toThrow(InvalidEventFacilitiesError);
    expect(await stored(events)).toBe("Wi-Fi");
  });

  it("tells a coordinator the event is not assigned to that it does not exist, and saves nothing", async () => {
    const { events, useCase } = build(event({ requiredFacilities: "Wi-Fi" }));
    await expect(
      useCase.execute({ eventId: "event-1", userAccountId: "coordinator-2", facilities: ["Catering area"] }),
    ).rejects.toThrow(CoordinatorEventNotFoundError);
    expect(await stored(events)).toBe("Wi-Fi");
  });

  it("gives an event that does not exist the same answer", async () => {
    const { useCase } = build();
    await expect(
      useCase.execute({ eventId: "nope", userAccountId: COORDINATOR, facilities: ["Wi-Fi"] }),
    ).rejects.toThrow(CoordinatorEventNotFoundError);
  });
});
