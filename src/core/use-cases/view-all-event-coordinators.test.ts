import { describe, expect, it } from "vitest";

import { InMemoryEventCoordinatorDirectory } from "@/adapters/outbound/in-memory/in-memory-event-coordinator-directory";
import type { EventCoordinatorDetails } from "@/core/ports/outbound/event-coordinator-directory";

import { ViewAllEventCoordinatorsUseCase } from "./view-all-event-coordinators";

describe("ViewAllEventCoordinatorsUseCase", () => {
  it("AC1: returns every Event Coordinator with all non-credential account fields", async () => {
    const coordinators: readonly EventCoordinatorDetails[] = [
      {
        userAccountId: "2",
        name: "Amara Sithole",
        contactDetails: "amara@example.com",
        communicationPreferences: "Email",
        department: "Event Coordination",
        availability: "Available",
        clientOrganisationId: null,
        createdAt: "2026-09-01T08:00:00.000Z",
        updatedAt: "2026-09-02T09:30:00.000Z",
      },
      {
        userAccountId: "5",
        name: "Jonas Berg",
        contactDetails: null,
        communicationPreferences: null,
        department: null,
        availability: null,
        clientOrganisationId: "3",
        createdAt: "2026-09-03T10:00:00.000Z",
        updatedAt: "2026-09-03T10:00:00.000Z",
      },
    ];
    const useCase = new ViewAllEventCoordinatorsUseCase({
      eventCoordinators: new InMemoryEventCoordinatorDirectory(coordinators),
    });

    await expect(useCase.execute()).resolves.toEqual({
      eventCoordinators: [
        {
          userAccountId: "2",
          name: "Amara Sithole",
          contactDetails: "amara@example.com",
          communicationPreferences: "Email",
          department: "Event Coordination",
          availability: "Available",
          clientOrganisationId: null,
          createdAt: "2026-09-01T08:00:00.000Z",
          updatedAt: "2026-09-02T09:30:00.000Z",
        },
        {
          userAccountId: "5",
          name: "Jonas Berg",
          contactDetails: null,
          communicationPreferences: null,
          department: null,
          availability: null,
          clientOrganisationId: "3",
          createdAt: "2026-09-03T10:00:00.000Z",
          updatedAt: "2026-09-03T10:00:00.000Z",
        },
      ],
    });
  });

  it("returns an empty list when no Event Coordinators exist", async () => {
    const useCase = new ViewAllEventCoordinatorsUseCase({
      eventCoordinators: new InMemoryEventCoordinatorDirectory(),
    });

    await expect(useCase.execute()).resolves.toEqual({ eventCoordinators: [] });
  });
});
