import { describe, expect, it } from "vitest";

import { eventRequestDetails, eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryClientOrganisationRepository } from "@/adapters/outbound/in-memory/in-memory-client-organisation-repository";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { InMemoryLeadEventRepository } from "@/adapters/outbound/in-memory/in-memory-lead-event-repository";
import { InMemoryUserAccountRepository } from "@/adapters/outbound/in-memory/in-memory-user-account-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import type { CoordinatorEvent } from "@/core/domain/coordinator-event";
import { NotCoordinatorLeadError } from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";
import type { EventCoordinatorDetails } from "@/core/ports/outbound/user-account-repository";

import { ViewCoordinatorWorkloadsUseCase } from "./view-coordinator-workloads";

const LEAD = userAccountId("lead-1");
const ORG = clientOrganisationId("org-a");

function coordinator(id: string, name: string): EventCoordinatorDetails {
  return {
    userAccountId: id,
    name,
    contactDetails: null,
    communicationPreferences: null,
    department: null,
    availability: null,
    clientOrganisationId: null,
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T08:00:00.000Z",
  };
}

function event(overrides: Partial<CoordinatorEvent> = {}): CoordinatorEvent {
  return {
    id: eventId("event-1"),
    name: "Founders' Gala Dinner",
    description: null,
    status: "Planning",
    preferredDate: "2026-12-12",
    expectedAttendance: 120,
    statedEquipmentNeeds: null,
    clientOrganisationId: ORG,
    owningOrganiserUserAccountId: userAccountId("organiser-1"),
    assignedCoordinatorUserAccountId: userAccountId("alice"),
    ...overrides,
  };
}

function useCase(events: readonly CoordinatorEvent[], leads = [LEAD]) {
  return new ViewCoordinatorWorkloadsUseCase({
    userAccounts: new InMemoryUserAccountRepository({
      eventCoordinators: [coordinator("alice", "Alice Tan"), coordinator("bob", "Bob Lim")],
    }),
    eventRequests: new InMemoryEventRequestRepository([
      eventRequestFixture({
        id: eventRequestId("request-1"),
        details: eventRequestDetails({ eventName: "Quarterly Partner Forum" }),
        status: "Under Review",
        assignedCoordinatorUserAccountId: userAccountId("alice"),
      }),
    ]),
    leadEvents: new InMemoryLeadEventRepository({ events, leads }),
    clientOrganisations: new InMemoryClientOrganisationRepository(new Map([[ORG, "Test Organisation"]])),
  });
}

describe("ViewCoordinatorWorkloadsUseCase (SPM-256)", () => {
  it("AC1: names every coordinator with their requests and active events", async () => {
    const result = await useCase([event()]).execute({ leadUserAccountId: LEAD });

    expect(result).toEqual({
      coordinators: [
        {
          userAccountId: "alice",
          name: "Alice Tan",
          requests: [
            {
              id: "request-1",
              eventName: "Quarterly Partner Forum",
              clientOrganisationName: "Test Organisation",
              preferredDate: "2026-11-04",
              status: "Under Review",
            },
          ],
          events: [
            {
              id: "event-1",
              name: "Founders' Gala Dinner",
              clientOrganisationName: "Test Organisation",
              preferredDate: "2026-12-12",
              status: "Planning",
            },
          ],
        },
        { userAccountId: "bob", name: "Bob Lim", requests: [], events: [] },
      ],
    });
  });

  it("AC3: lists an event under whoever is on it now -- it moves when reassigned", async () => {
    const result = await useCase([
      event({ assignedCoordinatorUserAccountId: userAccountId("bob") }),
    ]).execute({ leadUserAccountId: LEAD });

    const [alice, bob] = result.coordinators;
    expect(alice.events).toEqual([]);
    expect(bob.events.map((e) => e.id)).toEqual(["event-1"]);
  });

  it("refuses anyone who is not an Event Coordinator Lead", async () => {
    await expect(
      useCase([event()], []).execute({ leadUserAccountId: LEAD }),
    ).rejects.toBeInstanceOf(NotCoordinatorLeadError);
  });
});
