/**
 * Selectors over the wireframe fixtures.
 *
 * Each screen asks one question ("what is in my queue?") and gets an answer,
 * rather than filtering a global array inline. When these screens are wired to
 * real use cases, these are the call sites that change.
 */

import { ACTING_AS, EVENTS, VENUES } from "./fixtures";
import type {
  ArrangementRecord,
  BookingRecord,
  EquipmentReservationRecord,
  EventRecord,
  Person,
  StaffRole,
} from "./types";

export { ACTING_AS, EQUIPMENT_CATALOGUE, EVENTS, PEOPLE, VENUES } from "./fixtures";
export * from "./types";

export const ROLE_LABELS: Record<StaffRole, string> = {
  requester: "Event Organiser",
  ops: "Event Operations Manager",
  coordinator: "Event Coordinator",
  venue: "Venue Staff",
  technical: "Technical Support Staff",
};

export const STAFF_ROLES: readonly StaffRole[] = [
  "requester",
  "ops",
  "coordinator",
  "venue",
  "technical",
];

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

export function eventById(id: string): EventRecord | undefined {
  return EVENTS.find((candidate) => candidate.id === id);
}

/** The acting organiser's own requests -- drafts and submitted alike. */
export function requestsForOrganiser(organiser: Person = ACTING_AS.requester): EventRecord[] {
  return EVENTS.filter((event) => event.request.requestedBy.id === organiser.id);
}

export function draftRequests(organiser?: Person): EventRecord[] {
  return requestsForOrganiser(organiser).filter(
    (event) => event.request.status === "Draft",
  );
}

export function submittedRequests(organiser?: Person): EventRecord[] {
  return requestsForOrganiser(organiser).filter(
    (event) => event.request.status !== "Draft",
  );
}

/**
 * The operations manager's queue: submitted requests, unassigned first.
 *
 * Assignment is a simple write, not a workflow (#73, #93) -- so this is a
 * queue, not an approval chain.
 */
export function assignmentQueue(): EventRecord[] {
  return EVENTS.filter((event) => event.request.status !== "Draft").sort(
    (a, b) =>
      Number(a.request.assignedCoordinator !== null) -
      Number(b.request.assignedCoordinator !== null),
  );
}

export function awaitingAssignment(): EventRecord[] {
  return assignmentQueue().filter(
    (event) => event.request.assignedCoordinator === null,
  );
}

/** Events assigned to the acting coordinator. */
export function coordinatorEvents(
  coordinator: Person = ACTING_AS.coordinator,
): EventRecord[] {
  return EVENTS.filter((event) => event.coordinator?.id === coordinator.id);
}

/** Every event carrying a booking, whatever its state -- the venue queue. */
export function bookingQueue(): Array<{
  event: EventRecord;
  booking: BookingRecord;
}> {
  return EVENTS.flatMap((event) =>
    event.booking ? [{ event, booking: event.booking }] : [],
  ).sort(
    (a, b) =>
      Number(a.booking.status !== "Requested") -
      Number(b.booking.status !== "Requested"),
  );
}

export function bookingById(
  id: string,
): { event: EventRecord; booking: BookingRecord } | undefined {
  return bookingQueue().find((entry) => entry.booking.id === id);
}

/** Every event carrying an equipment reservation -- the technical queue. */
export function technicalQueue(): Array<{
  event: EventRecord;
  reservation: EquipmentReservationRecord;
}> {
  return EVENTS.flatMap((event) =>
    event.equipment ? [{ event, reservation: event.equipment }] : [],
  ).sort(
    (a, b) =>
      Number(a.reservation.status !== "Requested") -
      Number(b.reservation.status !== "Requested"),
  );
}

export function reservationById(
  id: string,
): { event: EventRecord; reservation: EquipmentReservationRecord } | undefined {
  return technicalQueue().find((entry) => entry.reservation.id === id);
}

/**
 * The confirmation gate (#80).
 *
 * An event may be confirmed with non-essential actions outstanding, but never
 * while an arrangement marked essential for that event is incomplete. Returns
 * the blocking rows so the screen can name them rather than just disabling a
 * button.
 */
export function blockingArrangements(
  event: EventRecord,
): readonly ArrangementRecord[] {
  return event.arrangements.filter(
    (arrangement) => arrangement.essential && !arrangement.complete,
  );
}

export function canConfirm(event: EventRecord): boolean {
  return (
    event.status !== "Confirmed" &&
    event.status !== "Completed" &&
    event.status !== "Cancelled" &&
    blockingArrangements(event).length === 0
  );
}

/**
 * Whether registration settings are editable.
 *
 * Registration sits downstream of confirmation (brief s5 step 11), so the
 * panel stays locked until the event is Confirmed. Mirrors the first clause of
 * `isOpenForRegistration` in the core domain.
 */
export function registrationUnlocked(event: EventRecord): boolean {
  return event.status === "Confirmed";
}

export function liveRegistrations(event: EventRecord): number {
  return event.registrations.filter(
    (registration) => registration.status === "Registered",
  ).length;
}

/** Venues that could plausibly host the event, for the coordinator's Venue tab. */
export function candidateVenues(event: EventRecord) {
  const needed = event.request.expectedAttendance ?? 0;
  return VENUES.map((venue) => ({
    venue,
    sufficientCapacity: (venue.capacity ?? 0) >= needed,
  }));
}
