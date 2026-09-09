/**
 * Selectors over the wireframe fixtures.
 *
 * Each screen asks one question ("what is in my queue?") and gets an answer,
 * rather than filtering a global array inline. When these screens are wired to
 * real use cases, these are the call sites that change.
 */

import { ACTING_AS, EVENTS, VENUES } from "./fixtures";
import { notificationsFor } from "./notifications";
import type {
  ArrangementRecord,
  BookingRecord,
  EquipmentReservationRecord,
  EventRecord,
  Person,
  StaffRole,
} from "./types";

export { ACTING_AS, EQUIPMENT_CATALOGUE, EVENTS, PEOPLE, VENUES } from "./fixtures";
export * from "./notifications";
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

// --- Sidebar list pane -----------------------------------------------------

/** The two sections every role's rail carries. */
export type SidebarSection = "queue" | "notifications";

/**
 * One row of the sidebar's list pane.
 *
 * Every role works a queue of something -- requests, events, bookings,
 * reservations -- so the pane takes one shape and each role supplies rows for
 * it, rather than five panes that happen to look alike.
 */
export interface ListPaneItem {
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly meta: string;
  readonly teaser: string;
  readonly status: string;
  readonly unread?: boolean;
}

function queueItemsFor(role: StaffRole): ListPaneItem[] {
  switch (role) {
    case "requester":
      return requestsForOrganiser().map((event) => ({
        id: event.id,
        href:
          event.request.status === "Draft"
            ? `/staff/requester/new?draft=${event.id}`
            : `/staff/requester/${event.id}`,
        title: event.request.eventName,
        meta: event.request.preferredDate ?? "No date",
        teaser: event.request.description ?? "Nothing filled in yet.",
        status: event.request.status,
      }));

    case "ops":
      return assignmentQueue().map((event) => ({
        id: event.id,
        href: `/staff/ops/${event.id}`,
        title: event.request.eventName,
        meta: event.request.submittedAt ?? "—",
        teaser:
          event.request.assignedCoordinator?.name ??
          "No coordinator assigned yet.",
        status: event.request.status,
      }));

    case "coordinator":
      return coordinatorEvents().map((event) => {
        const blocking = blockingArrangements(event);
        return {
          id: event.id,
          href: `/staff/coordinator/${event.id}`,
          title: event.name,
          meta: event.request.preferredDate ?? "No date",
          teaser:
            blocking.length === 0
              ? "Nothing outstanding."
              : `Blocked on ${blocking.map((row) => row.label.toLowerCase()).join(", ")}.`,
          status: event.status,
        };
      });

    case "venue":
      return bookingQueue().map(({ event, booking }) => ({
        id: booking.id,
        href: `/staff/venue/${booking.id}`,
        title: booking.venue.location,
        meta: `${booking.slotDate} · ${booking.slots.join(" + ")}`,
        teaser: `${event.name} · ${event.request.expectedAttendance ?? "—"} expected`,
        status: booking.status,
      }));

    case "technical":
      return technicalQueue().map(({ event, reservation }) => {
        const short = reservation.lines.filter(
          (line) => line.quantityReserved < line.quantityRequested,
        ).length;
        return {
          id: reservation.id,
          href: `/staff/technical/${reservation.id}`,
          title: event.name,
          meta: event.request.preferredDate ?? "No date",
          teaser:
            short === 0
              ? `${reservation.lines.length} lines, all filled.`
              : `${short} of ${reservation.lines.length} lines short.`,
          status: reservation.status,
        };
      });
  }
}

export function listPaneItems(
  role: StaffRole,
  section: SidebarSection,
): ListPaneItem[] {
  if (section === "notifications") {
    return notificationsFor(role).map((notification) => ({
      id: notification.id,
      // Through the inbox route, so opening one from the list pane does not
      // swap the pane out from under you.
      href: `/staff/${role}/notifications/${notification.id}`,
      title: notification.subject,
      meta: notification.receivedAt.split(" ")[0],
      teaser: notification.body,
      status: notification.trigger,
      unread: notification.unread,
    }));
  }

  return queueItemsFor(role);
}
