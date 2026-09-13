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
import { InMemoryOrganiserDirectory } from "./in-memory-organiser-directory";
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
  /**
   * What the Organiser filled in, for the requests a Coordinator opens.
   * Omitted elsewhere: an all-null request is itself worth demonstrating,
   * because the mandatory set is undecided (#72) and the detail view has to
   * render absence as absence.
   */
  details?: Partial<EventRequestDetails>;
}): EventRequest {
  return {
    id: eventRequestId(params.id),
    details: { ...detailsFor(params.eventName), ...params.details },
    status: params.status,
    clientOrganisationId: params.clientOrganisationId ?? SUNRISE,
    responsibleOrganiserId: params.responsibleOrganiserId,
    assignedCoordinatorUserAccountId: params.assignedCoordinatorUserAccountId ?? null,
    decisionRecord: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
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

  // Assigned to NADIA (SPM-121/SPM-32): spans both client organisations, so
  // the coordinator's queue can demonstrate a per-row organisation name.
  request({
    id: "request-venue-safety-review",
    eventName: "Venue Safety Review",
    status: "Under Review",
    responsibleOrganiserId: BEN,
    assignedCoordinatorUserAccountId: NADIA,
    details: {
      description: "A walkthrough of fire exits, capacity limits and accessible routes.",
      purpose: "Annual compliance check ahead of the winter events season.",
      preferredDate: "2026-10-14",
      preferredStartTime: "2026-10-14T09:00:00+08:00",
      preferredEndTime: "2026-10-14T11:00:00+08:00",
      expectedAttendance: 12,
      venueRequirements: "Access to every fire exit and the main hall.",
      accessibilityNeeds: "Step-free access required for two attendees.",
    },
  }),
  request({
    id: "request-harbour-conference",
    eventName: "Harbour Logistics Conference",
    status: "Under Review",
    clientOrganisationId: HARBOUR,
    responsibleOrganiserId: CARA,
    assignedCoordinatorUserAccountId: NADIA,
    details: {
      description: "A day of talks and workshops for the logistics team.",
      purpose: "Kick off next year's operations roadmap.",
      preferredDate: "2026-11-25",
      preferredStartTime: "2026-11-25T09:00:00+08:00",
      preferredEndTime: "2026-11-25T18:00:00+08:00",
      expectedAttendance: 300,
      equipmentRequirements: "Projector, stage microphones, livestream setup.",
      registrationRequirements: "Attendees must register in advance; no walk-ins.",
    },
  }),
  request({
    id: "request-vendor-day",
    eventName: "Vendor Appreciation Day",
    status: "Returned",
    responsibleOrganiserId: ALICE,
    assignedCoordinatorUserAccountId: NADIA,
    details: {
      description: "An informal thank-you event for this year's vendors.",
      purpose: "Strengthen vendor relationships ahead of contract renewals.",
      preferredDate: "2026-11-06",
      preferredStartTime: "2026-11-06T17:00:00+08:00",
      preferredEndTime: "2026-11-06T20:00:00+08:00",
      expectedAttendance: 60,
      venueRequirements: "Outdoor courtyard with a covered fallback.",
    },
  }),
  // Assigned but still Submitted: not what assignEventCoordinator (SPM-97)
  // leaves behind -- it moves a Submitted request to Under Review as it
  // assigns -- but a request assigned by any other route can land here, and
  // the queue must not drop it.
  request({
    id: "request-volunteer-briefing",
    eventName: "Winter Volunteer Briefing",
    status: "Submitted",
    responsibleOrganiserId: BEN,
    assignedCoordinatorUserAccountId: NADIA,
    details: {
      description: "A briefing for volunteers working the winter events season.",
      purpose: "Bring new volunteers up to speed before the season opens.",
      preferredDate: "2026-12-09",
      preferredStartTime: "2026-12-09T14:00:00+08:00",
      preferredEndTime: "2026-12-09T16:00:00+08:00",
      expectedAttendance: 45,
      venueRequirements: "A room that seats 45 with a projector.",
    },
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

/** SPM-39 AC5: reassignment candidates for the demo -- same shape the Supabase adapter reads from a real client organisation. */
export const demoOrganiserDirectory = new InMemoryOrganiserDirectory([
  { userAccountId: ALICE, name: "Alice", clientOrganisationId: SUNRISE },
  { userAccountId: BEN, name: "Ben", clientOrganisationId: SUNRISE },
  { userAccountId: CARA, name: "Cara", clientOrganisationId: HARBOUR },
]);
