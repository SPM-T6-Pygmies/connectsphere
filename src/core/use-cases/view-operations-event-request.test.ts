import { describe, expect, it } from "vitest";

import { eventRequestDetails, eventRequestFixture } from "@/adapters/outbound/in-memory/event-request-fixture";
import { InMemoryEventRequestRepository } from "@/adapters/outbound/in-memory/in-memory-event-request-repository";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { ViewOperationsEventRequestUseCase } from "./view-operations-event-request";

describe("ViewOperationsEventRequestUseCase", () => {
  it("returns the requested event request with its coordinator assignment", async () => {
    const request = eventRequestFixture({
      id: eventRequestId("42"),
      details: eventRequestDetails({
        eventName: "Leadership Workshop",
        description: "Workshop for department leaders",
      }),
      status: "Under Review",
      assignedCoordinatorUserAccountId: userAccountId("7"),
      updatedAt: new Date("2026-09-13T04:00:00.000Z"),
    });
    const useCase = new ViewOperationsEventRequestUseCase({
      eventRequests: new InMemoryEventRequestRepository([request]),
    });

    const result = await useCase.execute({ id: "42" });

    expect(result?.eventRequest).toMatchObject({
      id: "42",
      eventName: "Leadership Workshop",
      description: "Workshop for department leaders",
      status: "Under Review",
      assignedCoordinatorUserAccountId: "7",
      updatedAt: "2026-09-13T04:00:00.000Z",
    });
  });

  it("returns null when the event request does not exist", async () => {
    const useCase = new ViewOperationsEventRequestUseCase({
      eventRequests: new InMemoryEventRequestRepository(),
    });

    await expect(useCase.execute({ id: "404" })).resolves.toBeNull();
  });
});
