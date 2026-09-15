import { describe, expect, it } from "vitest";

import { eventRequestDetails, eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ViewAllEventRequestsUseCase } from "./view-all-event-requests";

describe("ViewAllEventRequestsUseCase", () => {
  it("AC1: returns every submitted request across organisations, with its assignment and queue", async () => {
    const unassignedRequest = eventRequestFixture({
      id: eventRequestId("request-1"),
      details: eventRequestDetails({ eventName: "Unassigned request" }),
      status: "Submitted",
      submittedAt: new Date("2026-09-01T09:00:00.000Z"),
    });
    const assignedRequest = eventRequestFixture({
      id: eventRequestId("request-2"),
      details: eventRequestDetails({
        eventName: "Assigned request",
        description: "Annual client forum",
      }),
      status: "Under Review",
      clientOrganisationId: clientOrganisationId("org-b"),
      responsibleOrganiserId: userAccountId("organiser-2"),
      assignedCoordinatorUserAccountId: userAccountId("coordinator-1"),
      decisionRecord: "Review started",
      submittedAt: new Date("2026-09-02T09:00:00.000Z"),
      createdAt: new Date("2026-09-02T08:00:00.000Z"),
      updatedAt: new Date("2026-09-02T09:00:00.000Z"),
    });
    const useCase = new ViewAllEventRequestsUseCase({
      eventRequests: new InMemoryEventRequestRepository([unassignedRequest, assignedRequest]),
    });

    const result = await useCase.execute();

    expect(result.eventRequests).toHaveLength(2);
    expect(result.eventRequests[0]).toMatchObject({
      eventName: "Unassigned request",
      status: "Submitted",
      assignedCoordinatorUserAccountId: null,
      clientOrganisationId: "org-a",
      queue: "unassigned",
    });
    expect(result.eventRequests[1]).toEqual({
      id: "request-2",
      eventName: "Assigned request",
      description: "Annual client forum",
      purpose: null,
      preferredDate: "2026-11-04",
      preferredStartTime: "2026-11-04T09:00",
      preferredEndTime: "2026-11-04T17:00",
      expectedAttendance: 120,
      venueRequirements: null,
      accessibilityNeeds: null,
      equipmentRequirements: null,
      registrationRequirements: null,
      roomLayoutPreferences: null,
      generalProgramme: null,
      otherSpecialArrangements: null,
      status: "Under Review",
      decisionRecord: "Review started",
      requestingUserAccountId: "organiser-2",
      assignedCoordinatorUserAccountId: "coordinator-1",
      clientOrganisationId: "org-b",
      createdAt: "2026-09-02T08:00:00.000Z",
      updatedAt: "2026-09-02T09:00:00.000Z",
      queue: "assigned",
    });
  });

  it("never returns a Draft -- it is the Organiser's alone, not Operations'", async () => {
    const useCase = new ViewAllEventRequestsUseCase({
      eventRequests: new InMemoryEventRequestRepository([
        eventRequestFixture({ details: eventRequestDetails({ eventName: "Draft request" }) }),
      ]),
    });

    await expect(useCase.execute()).resolves.toEqual({ eventRequests: [] });
  });

  it("AC2: returns an empty list when no event requests exist", async () => {
    const useCase = new ViewAllEventRequestsUseCase({
      eventRequests: new InMemoryEventRequestRepository(),
    });

    await expect(useCase.execute()).resolves.toEqual({ eventRequests: [] });
  });
});
