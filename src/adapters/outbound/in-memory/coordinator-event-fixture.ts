import { clientOrganisationId } from "@/core/domain/client-organisation";
import type { CoordinatorEvent } from "@/core/domain/coordinator-event";
import { eventId } from "@/core/domain/event";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

export function coordinatorEventFixture(overrides: Partial<CoordinatorEvent> = {}): CoordinatorEvent {
  return {
    id: eventId("event-1"),
    eventRequestId: eventRequestId("request-1"),
    name: "Autumn Product Showcase",
    status: "Confirmed",
    preferredDate: "2026-10-14",
    clientOrganisationId: clientOrganisationId("org-a"),
    assignedCoordinatorUserAccountId: userAccountId("coordinator-1"),
    ...overrides,
  };
}
