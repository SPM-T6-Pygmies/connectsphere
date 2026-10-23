import { describe, expect, it } from "vitest";

import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";

import { FindAssignedEventByRequestUseCase } from "./find-assigned-event-by-request";

const EVENT: SeedCoordinatorEvent = {
  id: "event-1",
  eventRequestId: "request-1",
  name: "Annual Conference",
  clientOrganisationName: "Acme",
  preferredDate: "2026-10-05",
  status: "Planning",
  assignedCoordinatorUserAccountId: "coordinator-1",
  description: null,
  expectedAttendance: null,
  clientOrganisationId: "org-1",
  owningOrganiserUserAccountId: "organiser-1",
};

function find(eventRequestId: string, userAccountId: string) {
  return new FindAssignedEventByRequestUseCase({
    events: new InMemoryCoordinatorEventRepository([EVENT]),
  }).execute({ eventRequestId, userAccountId });
}

describe("FindAssignedEventByRequestUseCase (SPM-62)", () => {
  it("finds the event opened from the request, for its assigned coordinator", async () => {
    await expect(find("request-1", "coordinator-1")).resolves.toBe("event-1");
  });

  it("finds nothing for a coordinator the event is not assigned to (#91)", async () => {
    await expect(find("request-1", "coordinator-2")).resolves.toBeNull();
  });

  it("finds nothing for a request no event was opened from", async () => {
    await expect(find("request-404", "coordinator-1")).resolves.toBeNull();
  });
});
