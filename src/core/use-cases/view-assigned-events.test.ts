import { describe, expect, it } from "vitest";

import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { userAccountId } from "@/core/domain/user-account";

import { ViewAssignedEventsUseCase } from "./view-assigned-events";

const COORDINATOR = userAccountId("coordinator-1");
const OTHER_COORDINATOR = userAccountId("coordinator-2");

function event(overrides: Partial<SeedCoordinatorEvent> = {}): SeedCoordinatorEvent {
  return {
    id: "event-1",
    eventRequestId: "request-1",
    name: "Autumn Product Showcase",
    clientOrganisationName: "Sunrise Events Co",
    preferredDate: "2026-10-14",
    status: "Confirmed",
    assignedCoordinatorUserAccountId: COORDINATOR,
    description: null,
    expectedAttendance: null,
    clientOrganisationId: "org-1",
    owningOrganiserUserAccountId: "organiser-1",
    ...overrides,
  };
}

function buildUseCase(seed: readonly SeedCoordinatorEvent[]) {
  return new ViewAssignedEventsUseCase({
    events: new InMemoryCoordinatorEventRepository(seed),
  });
}

describe("ViewAssignedEventsUseCase (SPM-137)", () => {
  it("lists an event assigned to the caller, with its client organisation's name", async () => {
    const useCase = buildUseCase([event()]);

    const result = await useCase.execute({ userAccountId: COORDINATOR });

    expect(result.events).toEqual([
      {
        id: "event-1",
        eventRequestId: "request-1",
        name: "Autumn Product Showcase",
        clientOrganisationName: "Sunrise Events Co",
        preferredDate: "2026-10-14",
        status: "Confirmed",
      },
    ]);
  });

  it("never returns an event assigned to a different coordinator", async () => {
    const useCase = buildUseCase([event({ assignedCoordinatorUserAccountId: OTHER_COORDINATOR })]);

    const result = await useCase.execute({ userAccountId: COORDINATOR });

    expect(result.events).toEqual([]);
  });

  it.each(["Planning", "Blocked", "Confirmed", "Completed", "Cancelled"] as const)(
    "includes a %s event -- unlike requests, events aren't status-filtered",
    async (status) => {
      const useCase = buildUseCase([event({ status })]);

      const result = await useCase.execute({ userAccountId: COORDINATOR });

      expect(result.events).toHaveLength(1);
    },
  );

  it("returns an empty list rather than an error when nothing is assigned", async () => {
    const useCase = buildUseCase([]);

    const result = await useCase.execute({ userAccountId: COORDINATOR });

    expect(result.events).toEqual([]);
  });
});
