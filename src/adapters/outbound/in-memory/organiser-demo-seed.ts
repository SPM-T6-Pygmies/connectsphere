import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import { clientOrganisationId } from "@/core/domain/client-organisation";
import {
  eventRequestId,
  type EventRequest,
  type EventRequestDetails,
  type EventRequestStatus,
} from "@/core/domain/event-request";
import { userAccountId, type UserAccountId } from "@/core/domain/user-account";

import { InMemoryEventRequestRepository } from "./in-memory-event-request-repository";
import { InMemoryOrganiserDirectory } from "./in-memory-organiser-directory";

/**
 * Demonstration data for running the "view my organisation's events" page
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
}): EventRequest {
  return {
    id: eventRequestId(params.id),
    details: detailsFor(params.eventName),
    status: params.status,
    clientOrganisationId: params.clientOrganisationId ?? SUNRISE,
    responsibleOrganiserId: params.responsibleOrganiserId,
    // Null until the request leaves Draft (see `EventRequest.submittedAt`).
    submittedAt: params.status === "Draft" ? null : new Date(),
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
];

export const demoEventRequestRepository = new InMemoryEventRequestRepository(EVENT_REQUESTS);

/** SPM-39 AC5: reassignment candidates for the demo -- same shape the Supabase adapter reads from a real client organisation. */
export const demoOrganiserDirectory = new InMemoryOrganiserDirectory([
  { userAccountId: ALICE, name: "Alice", clientOrganisationId: SUNRISE },
  { userAccountId: BEN, name: "Ben", clientOrganisationId: SUNRISE },
  { userAccountId: CARA, name: "Cara", clientOrganisationId: HARBOUR },
]);
