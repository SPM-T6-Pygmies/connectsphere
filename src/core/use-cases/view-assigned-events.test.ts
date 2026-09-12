import { describe, expect, it } from "vitest";

import { coordinatorEventFixture } from "@/adapters/outbound/in-memory/coordinator-event-fixture";
import { InMemoryClientOrganisationRepository } from "@/adapters/outbound/in-memory/in-memory-client-organisation-repository";
import { InMemoryCoordinatorEventRepository } from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import { type CoordinatorEvent } from "@/core/domain/coordinator-event";
import { userAccountId } from "@/core/domain/user-account";

import { ViewAssignedEventsUseCase } from "./view-assigned-events";

const ORG_A = clientOrganisationId("org-a");
const COORDINATOR = userAccountId("coordinator-1");
const OTHER_COORDINATOR = userAccountId("coordinator-2");

const ORG_NAMES = new Map([[ORG_A, "Sunrise Events Co"]]);

function event(overrides: Partial<CoordinatorEvent> = {}): CoordinatorEvent {
  return coordinatorEventFixture({
    clientOrganisationId: ORG_A,
    assignedCoordinatorUserAccountId: COORDINATOR,
    ...overrides,
  });
}

function buildUseCase(seed: readonly CoordinatorEvent[]) {
  return new ViewAssignedEventsUseCase({
    events: new InMemoryCoordinatorEventRepository(seed),
    clientOrganisations: new InMemoryClientOrganisationRepository(ORG_NAMES),
  });
}

describe("ViewAssignedEventsUseCase", () => {
  it("lists an event assigned to the caller, with its client organisation's name", async () => {
    const useCase = buildUseCase([event()]);

    const result = await useCase.execute({ userAccountId: COORDINATOR });

    expect(result.events).toEqual([
      {
        id: "event-1",
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
