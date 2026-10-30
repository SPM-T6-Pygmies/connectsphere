import { describe, expect, it } from "vitest";

import { InMemoryChangeRequestRepository } from "@/adapters/outbound/in-memory/in-memory-change-request-repository";
import {
  InMemoryCoordinatorEventRepository,
  type SeedCoordinatorEvent,
} from "@/adapters/outbound/in-memory/in-memory-coordinator-event-repository";
import { changeRequestId, type ChangeRequest } from "@/core/domain/change-request";

import { ViewEventChangeRequestsUseCase } from "./view-event-change-requests";

const COORDINATOR = "coordinator-1";
const EVENT = "event-1";

const seed: SeedCoordinatorEvent = {
  id: EVENT,
  eventRequestId: "request-1",
  name: "Annual Conference",
  clientOrganisationName: "Acme",
  preferredDate: "2026-11-20",
  status: "Planning",
  assignedCoordinatorUserAccountId: COORDINATOR,
  description: null,
  expectedAttendance: 300,
  statedEquipmentNeeds: "Two mics",
  venueRequirements: "Ground floor",
  clientOrganisationId: "org-1",
  owningOrganiserUserAccountId: "organiser-1",
  times: [{ date: "2026-11-20", start: "09:00", end: "12:00" }],
  registrationEnabled: true,
  registrationOpensOn: "2026-11-01",
  registrationClosesOn: "2026-11-15",
};

const decided: ChangeRequest = {
  id: changeRequestId("3"),
  submittedAt: new Date("2026-10-20T02:00:00Z"),
  items: [{ change: { field: "expected_attendance", value: 320 }, decision: "Declined", reason: "Room caps at 300" }],
};
const open: ChangeRequest = {
  id: changeRequestId("4"),
  submittedAt: new Date("2026-10-27T02:00:00Z"),
  items: [{ change: { field: "venue_requirements", value: "Theatre seating" }, decision: "Pending", reason: null }],
};

function build() {
  const changeRequests = new InMemoryChangeRequestRepository({}, { [EVENT]: [decided, open] });
  const coordinatorEvents = new InMemoryCoordinatorEventRepository([seed]);
  return new ViewEventChangeRequestsUseCase({ changeRequests, coordinatorEvents });
}

describe("ViewEventChangeRequestsUseCase (SPM-100)", () => {
  it("AC1: shows the open request beside each field's current value, and the decided ones as history", async () => {
    const view = await build().execute({ eventId: EVENT, userAccountId: COORDINATOR });

    expect(view).toEqual({
      eventName: "Annual Conference",
      current: {
        times: seed.times,
        venue_requirements: "Ground floor",
        expected_attendance: 300,
        equipment_requirements: "Two mics",
        registration: { enabled: true, opensOn: "2026-11-01", closesOn: "2026-11-15" },
      },
      open,
      decided: [decided],
    });
  });

  it("shows nothing to a Coordinator the event is not assigned to (#91)", async () => {
    expect(await build().execute({ eventId: EVENT, userAccountId: "coordinator-2" })).toBeNull();
  });
});
