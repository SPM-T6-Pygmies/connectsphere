import { clientOrganisationId } from "@/core/domain/client-organisation";
import {
  eventRequestId,
  type EventRequest,
  type EventRequestDetails,
} from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

/**
 * Builders for the tests, next to the in-memory adapters they are used with.
 *
 * `EventRequestDetails` has thirteen members, twelve of them nullable, so a
 * test that wants "a request missing its preferred time" would otherwise open
 * with a wall of `null`s that says nothing about what is being tested. These
 * default everything to absent and let each test state only the field it cares
 * about.
 */
export function eventRequestDetails(
  overrides: Partial<EventRequestDetails> = {},
): EventRequestDetails {
  return {
    eventName: "Founders' Day",
    description: null,
    purpose: null,
    preferredDate: "2026-11-04",
    preferredStartTime: "2026-11-04T09:00",
    preferredEndTime: "2026-11-04T17:00",
    expectedAttendance: 120,
    venueRequirements: null,
    roomLayoutPreferences: null,
    accessibilityNeeds: null,
    equipmentRequirements: null,
    registrationRequirements: null,
    generalProgramme: null,
    otherSpecialArrangements: null,
    ...overrides,
  };
}

export function eventRequestFixture(overrides: Partial<EventRequest> = {}): EventRequest {
  return {
    id: eventRequestId("request-1"),
    details: eventRequestDetails(),
    status: "Draft",
    clientOrganisationId: clientOrganisationId("org-a"),
    responsibleOrganiserId: userAccountId("organiser-1"),
    assignedCoordinatorUserAccountId: null,
    decisionRecord: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    submittedAt: null,
    ...overrides,
  };
}
