import { clientOrganisationId } from "@/core/domain/client-organisation";
import { eventRequestId, type EventRequest } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { InMemoryEventRequestRepository } from "./in-memory-event-request-repository";

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

function request(overrides: Partial<EventRequest> & Pick<EventRequest, "id">): EventRequest {
  return {
    eventName: "Untitled request",
    status: "Draft",
    clientOrganisationId: SUNRISE,
    responsibleOrganiserId: ALICE,
    ...overrides,
  };
}

const EVENT_REQUESTS: readonly EventRequest[] = [
  request({
    id: eventRequestId("request-founders-day"),
    eventName: "Founders' Day Celebration",
    status: "Draft",
    responsibleOrganiserId: ALICE,
  }),
  request({
    id: eventRequestId("request-partner-forum"),
    eventName: "Quarterly Partner Forum",
    status: "Submitted",
    responsibleOrganiserId: BEN,
  }),
  request({
    id: eventRequestId("request-client-showcase"),
    eventName: "Client Showcase",
    status: "Approved",
    responsibleOrganiserId: ALICE,
  }),
  request({
    id: eventRequestId("request-harbour-agm"),
    eventName: "Annual General Meeting",
    status: "Draft",
    clientOrganisationId: HARBOUR,
    responsibleOrganiserId: CARA,
  }),
];

export const demoEventRequestRepository = new InMemoryEventRequestRepository(EVENT_REQUESTS);
