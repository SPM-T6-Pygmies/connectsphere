import { describe, expect, it } from "vitest";

import { InMemoryClientOrganisationRepository } from "@/adapters/outbound/in-memory/in-memory-client-organisation-repository";
import { InMemoryLeadEventRepository } from "@/adapters/outbound/in-memory/in-memory-lead-event-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import type { LeadEvent } from "@/core/domain/coordinator-workload";
import { NotCoordinatorLeadError } from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ViewLeadEventUseCase } from "./view-lead-event";

const LEAD = userAccountId("lead-1");
const ORG = clientOrganisationId("org-a");

function event(status: CoordinatorEventStatus): LeadEvent {
  return {
    id: eventId("9"),
    eventRequestId: eventRequestId("4"),
    name: "Venue Safety Review",
    description: null,
    status,
    preferredDate: "2026-11-04",
    expectedAttendance: 40,
    statedEquipmentNeeds: null,
    clientOrganisationId: ORG,
    owningOrganiserUserAccountId: userAccountId("organiser-1"),
    assignedCoordinatorUserAccountId: userAccountId("coordinator-1"),
  };
}

function useCase(events: readonly LeadEvent[], leads = [LEAD]) {
  return new ViewLeadEventUseCase({
    leadEvents: new InMemoryLeadEventRepository({ events, leads }),
    clientOrganisations: new InMemoryClientOrganisationRepository(new Map([[ORG, "Acme Holdings"]])),
  });
}

describe("ViewLeadEventUseCase (SPM-257)", () => {
  it("AC1: opens an active event, named, as one whose coordinator can change", async () => {
    await expect(
      useCase([event("Blocked")]).execute({ eventId: "9", leadUserAccountId: LEAD }),
    ).resolves.toEqual({
      event: {
        id: "9",
        name: "Venue Safety Review",
        status: "Blocked",
        preferredDate: "2026-11-04",
        clientOrganisationName: "Acme Holdings",
        assignedCoordinatorUserAccountId: "coordinator-1",
      },
      canReassignCoordinator: true,
    });
  });

  it("AC1: opens a Completed event as one whose coordinator cannot change", async () => {
    const result = await useCase([event("Completed")]).execute({ eventId: "9", leadUserAccountId: LEAD });

    expect(result?.canReassignCoordinator).toBe(false);
  });

  it("returns null for an event that does not exist", async () => {
    await expect(useCase([]).execute({ eventId: "9", leadUserAccountId: LEAD })).resolves.toBeNull();
  });

  it("refuses anyone who is not an Event Coordinator Lead", async () => {
    await expect(
      useCase([event("Planning")], []).execute({ eventId: "9", leadUserAccountId: LEAD }),
    ).rejects.toBeInstanceOf(NotCoordinatorLeadError);
  });
});
