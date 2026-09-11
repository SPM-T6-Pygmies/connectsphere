import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import {
  eventRequestId,
  type EventRequest,
  type EventRequestDetails,
  type EventRequestStatus,
} from "@/core/domain/event-request";
import { userAccountId, type UserAccountId } from "@/core/domain/user-account";

import { InMemoryClientOrganisationRepository } from "./in-memory-client-organisation-repository";
import { InMemoryEventRequestRepository } from "./in-memory-event-request-repository";
import { InMemoryUserAccountRepository } from "./in-memory-user-account-repository";

/**
 * Demonstration data for running the "view my organisation's events" page,
 * and the coordinator's "assigned to me" list/detail (SPM-121, SPM-32),
 * without a database. The team has no Supabase project yet, so the
 * composition root falls back to this the same way it already does for the
 * attendee pages (see `attendee-demo-seed.ts`).
 *
 * Two client organisations, so the demo can show both "colleagues in my
 * organisation" (SUNRISE) and "cannot see an unrelated organisation" (HARBOUR)
 * from the same seed.
 */
export const SUNRISE = clientOrganisationId("sunrise-events-co");
export const HARBOUR = clientOrganisationId("harbour-logistics");

export const ALICE = userAccountId("organiser-alice");
export const BEN = userAccountId("organiser-ben");
export const CARA = userAccountId("organiser-cara");

/** SPM-121/SPM-32: demonstrable only against seeded data until SPM-97 (assign a coordinator) ships. */
export const NADIA = userAccountId("coordinator-nadia");
export const OMAR = userAccountId("coordinator-omar");

function detailsFor(eventName: string): EventRequestDetails {
  return {
    eventName,
    description: null,
    purpose: null,
    preferredDate: null,
    preferredStartTime: null,
    preferredEndTime: null,
    expectedAttendance: null,
    venueRequirements: null,
    roomLayoutPreferences: null,
    accessibilityNeeds: null,
    equipmentRequirements: null,
    registrationRequirements: null,
    generalProgramme: null,
    otherSpecialArrangements: null,
  };
}

function request(params: {
  id: string;
  eventName: string;
  status: EventRequestStatus;
  responsibleOrganiserId: UserAccountId;
  clientOrganisationId?: ClientOrganisationId;
  assignedCoordinatorUserAccountId?: UserAccountId;
}): EventRequest {
  return {
    id: eventRequestId(params.id),
    details: detailsFor(params.eventName),
    status: params.status,
    clientOrganisationId: params.clientOrganisationId ?? SUNRISE,
    responsibleOrganiserId: params.responsibleOrganiserId,
    // Null until the request leaves Draft (see `EventRequest.submittedAt`).
    submittedAt: params.status === "Draft" ? null : new Date(),
    assignedCoordinatorUserAccountId: params.assignedCoordinatorUserAccountId ?? null,
  };
}

const EVENT_REQUESTS: readonly EventRequest[] = [
  request({
    id: "request-founders-day",
    eventName: "Founders' Day Celebration",
    status: "Draft",
    responsibleOrganiserId: ALICE,
  }),
  request({
    id: "request-partner-forum",
    eventName: "Quarterly Partner Forum",
    status: "Submitted",
    responsibleOrganiserId: BEN,
  }),
  request({
    id: "request-client-showcase",
    eventName: "Client Showcase",
    status: "Approved",
    responsibleOrganiserId: ALICE,
  }),
  request({
    id: "request-harbour-agm",
    eventName: "Annual General Meeting",
    status: "Draft",
    clientOrganisationId: HARBOUR,
    responsibleOrganiserId: CARA,
  }),

  // Assigned to NADIA (SPM-121/SPM-32): spans both client organisations, so
  // the coordinator's queue can demonstrate a per-row organisation name.
  request({
    id: "request-venue-safety-review",
    eventName: "Venue Safety Review",
    status: "Under Review",
    responsibleOrganiserId: BEN,
    assignedCoordinatorUserAccountId: NADIA,
  }),
  request({
    id: "request-harbour-conference",
    eventName: "Harbour Logistics Conference",
    status: "Under Review",
    clientOrganisationId: HARBOUR,
    responsibleOrganiserId: CARA,
    assignedCoordinatorUserAccountId: NADIA,
  }),
  request({
    id: "request-vendor-day",
    eventName: "Vendor Appreciation Day",
    status: "Returned",
    responsibleOrganiserId: ALICE,
    assignedCoordinatorUserAccountId: NADIA,
  }),
  // Approved: frozen and reachable by direct id (SPM-32), but excluded from
  // the queue (SPM-121) -- it has become an Event, a separate backlog view.
  request({
    id: "request-gala-dinner",
    eventName: "Founders' Gala Dinner",
    status: "Approved",
    responsibleOrganiserId: ALICE,
    assignedCoordinatorUserAccountId: NADIA,
  }),
  // Assigned to a different coordinator: must never appear in NADIA's queue
  // or be reachable by NADIA via direct id (#91).
  request({
    id: "request-townhall",
    eventName: "Quarterly Townhall",
    status: "Under Review",
    responsibleOrganiserId: BEN,
    assignedCoordinatorUserAccountId: OMAR,
  }),
];

export const demoEventRequestRepository = new InMemoryEventRequestRepository(EVENT_REQUESTS);

/** Names for the ids above, for the coordinator's "assigned to me" views (SPM-121, SPM-32). */
export const demoClientOrganisationRepository = new InMemoryClientOrganisationRepository(
  new Map([
    [SUNRISE, "Sunrise Events Co"],
    [HARBOUR, "Harbour Logistics"],
  ]),
);

export const demoUserAccountRepository = new InMemoryUserAccountRepository(
  new Map([
    [ALICE, "Alice"],
    [BEN, "Ben"],
    [CARA, "Cara"],
    [NADIA, "Nadia"],
    [OMAR, "Omar"],
  ]),
);
