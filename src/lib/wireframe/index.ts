/**
 * Selectors over the wireframe fixtures.
 *
 * Each screen asks one question ("what is in my queue?") and gets an answer,
 * rather than filtering a global array inline. When these screens are wired to
 * real use cases, these are the call sites that change.
 */

import { ACTING_AS, EVENTS, VENUES } from "./fixtures";
import { ACTIVITY } from "./activity";
import { notificationsFor } from "./notifications";
import type { NotificationTrigger } from "./notifications";
import type {
  ActivityEntry,
  ActivitySection,
  ArrangementRecord,
  BookingRecord,
  BookingStatus,
  EquipmentReservationRecord,
  EquipmentReservationStatus,
  EventRecord,
  EventRequestStatus,
  EventStatus,
  FulfilmentStatus,
  Person,
  RegistrationStatus,
  StaffRole,
} from "./types";

export { ACTING_AS, EQUIPMENT_CATALOGUE, EVENTS, PEOPLE, VENUES } from "./fixtures";
export { ACTIVITY } from "./activity";
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

/** Every status-like value displayed in the sidebar list pane. */
export type AnyStatus =
  | EventRequestStatus
  | EventStatus
  | BookingStatus
  | EquipmentReservationStatus
  | FulfilmentStatus
  | RegistrationStatus
  | NotificationTrigger;

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

/** The counterpart to awaitingAssignment(): requests that already have a coordinator. */
export function assignedRequests(): EventRecord[] {
  return assignmentQueue().filter(
    (event) => event.request.assignedCoordinator !== null,
  );
}

/** Events assigned to the acting coordinator. */
export function coordinatorEvents(
  coordinator: Person = ACTING_AS.coordinator,
): EventRecord[] {
  return EVENTS.filter((event) => event.coordinator?.id === coordinator.id);
}

/** Events assigned to the coordinator that are still awaiting their decision. */
export function pendingCoordinatorRequests(
  coordinator: Person = ACTING_AS.coordinator,
): EventRecord[] {
  return coordinatorEvents(coordinator).filter(
    (event) =>
      event.request.status === "Submitted" ||
      event.request.status === "Under Review",
  );
}

/** Events assigned to the coordinator that have been approved to plan. */
export function approvedCoordinatorEvents(
  coordinator: Person = ACTING_AS.coordinator,
): EventRecord[] {
  return coordinatorEvents(coordinator).filter(
    (event) => event.request.status === "Approved",
  );
}

/** Events assigned to the coordinator whose request was resolved without approval. */
export function archivedCoordinatorRequests(
  coordinator: Person = ACTING_AS.coordinator,
): EventRecord[] {
  return coordinatorEvents(coordinator).filter((event) =>
    ["Rejected", "Returned", "Withdrawn"].includes(event.request.status),
  );
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

/** Bookings the venue team has not yet decided. */
export function bookingsAwaitingDecision(): ReturnType<typeof bookingQueue> {
  return bookingQueue().filter(({ booking }) => booking.status === "Requested");
}

/** Bookings the venue team has approved or tentatively held. */
export function decidedBookings(): ReturnType<typeof bookingQueue> {
  return bookingQueue().filter(
    ({ booking }) =>
      booking.status === "Tentative Hold" || booking.status === "Confirmed",
  );
}

/** Bookings resolved without a live hold: rejected, released or cancelled. */
export function archivedBookings(): ReturnType<typeof bookingQueue> {
  return bookingQueue().filter(({ booking }) =>
    ["Rejected", "Released", "Cancelled"].includes(booking.status),
  );
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

/** Equipment reservations technical support has not yet reviewed. */
export function reservationsNeedingReview(): ReturnType<typeof technicalQueue> {
  return technicalQueue().filter(
    ({ reservation }) => reservation.status === "Requested",
  );
}

/** Equipment reservations technical support has already dispositioned. */
export function reviewedReservations(): ReturnType<typeof technicalQueue> {
  return technicalQueue().filter(({ reservation }) =>
    ["Reserved", "Partially Reserved", "Unavailable"].includes(
      reservation.status,
    ),
  );
}

/** Equipment reservations resolved and put away: released or returned. */
export function archivedReservations(): ReturnType<typeof technicalQueue> {
  return technicalQueue().filter(({ reservation }) =>
    ["Released", "Returned"].includes(reservation.status),
  );
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

/** The sections a role's rail can carry -- each role uses its own subset. */
export type SidebarSection =
  | "notifications"
  | "drafts"
  | "submitted"
  | "unassigned"
  | "assigned"
  | "requests"
  | "events"
  | "archive"
  | "requested"
  | "decided"
  | "needsReview"
  | "reviewed";

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
  readonly status: AnyStatus;
  readonly unread?: boolean;
}

function queueItemsFor(role: StaffRole, section: SidebarSection): ListPaneItem[] {
  switch (role) {
    case "requester": {
      const events = section === "submitted" ? submittedRequests() : draftRequests();
      return events.map((event) => ({
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
    }

    case "ops": {
      const events = section === "assigned" ? assignedRequests() : awaitingAssignment();
      return events.map((event) => ({
        id: event.id,
        href: `/staff/ops/${event.id}`,
        title: event.request.eventName,
        meta: event.request.submittedAt ?? "—",
        teaser:
          event.request.assignedCoordinator?.name ??
          "No coordinator assigned yet.",
        status: event.request.status,
      }));
    }

    case "coordinator": {
      if (section === "events") {
        return approvedCoordinatorEvents().map((event) => {
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
      }
      if (section === "archive") {
        return archivedCoordinatorRequests().map((event) => ({
          id: event.id,
          href: `/staff/coordinator/${event.id}`,
          title: event.name,
          meta: event.request.updatedAt,
          teaser: event.request.decisionRecord ?? "No decision record.",
          status: event.request.status,
        }));
      }
      return pendingCoordinatorRequests().map((event) => ({
        id: event.id,
        href: `/staff/coordinator/${event.id}`,
        title: event.name,
        meta: event.request.submittedAt ?? "Not yet submitted",
        teaser: event.request.description ?? "Nothing filled in yet.",
        status: event.request.status,
      }));
    }

    case "venue": {
      const entries =
        section === "decided"
          ? decidedBookings()
          : section === "archive"
            ? archivedBookings()
            : bookingsAwaitingDecision();
      return entries.map(({ event, booking }) => ({
        id: booking.id,
        href: `/staff/venue/${booking.id}`,
        title: booking.venue.location,
        meta: `${booking.slotDate} · ${booking.slots.join(" + ")}`,
        teaser: `${event.name} · ${event.request.expectedAttendance ?? "—"} expected`,
        status: booking.status,
      }));
    }

    case "technical": {
      const entries =
        section === "reviewed"
          ? reviewedReservations()
          : section === "archive"
            ? archivedReservations()
            : reservationsNeedingReview();
      return entries.map(({ event, reservation }) => {
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

  return queueItemsFor(role, section);
}

// --- Activity and comments -------------------------------------------------

/**
 * The trail for one event, oldest first.
 *
 * Pass a section to narrow it to one surface -- the Venue tab wants venue
 * activity, not the whole event's history -- and omit it for everything.
 */
export function activityFor(
  eventId: string,
  section?: ActivitySection,
): ActivityEntry[] {
  return ACTIVITY.filter(
    (entry) =>
      entry.eventId === eventId &&
      (section === undefined || entry.section === section),
  ).sort((a, b) => a.at.localeCompare(b.at));
}

/** A comment with the replies made to it. */
export interface CommentThread {
  readonly entry: Extract<ActivityEntry, { kind: "comment" }>;
  readonly replies: ReadonlyArray<Extract<ActivityEntry, { kind: "comment" }>>;
}

/** One feed row: either something the system recorded, or a comment thread. */
export type FeedRow =
  | { readonly kind: "activity"; readonly entry: Extract<ActivityEntry, { kind: "activity" }> }
  | { readonly kind: "thread"; readonly thread: CommentThread };

/**
 * The trail as it is read: system entries in place, and every comment carrying
 * the replies made to it.
 *
 * One level deep. A reply to a reply is folded onto the top-level comment
 * rather than nesting further -- the customer left threading open as a UI
 * decision, and one level is what "reply to a comment" needs.
 */
export function feedRows(entries: readonly ActivityEntry[]): FeedRow[] {
  const replies = new Map<string, Array<Extract<ActivityEntry, { kind: "comment" }>>>();

  for (const entry of entries) {
    if (entry.kind === "comment" && entry.parentId !== null) {
      const bucket = replies.get(entry.parentId) ?? [];
      bucket.push(entry);
      replies.set(entry.parentId, bucket);
    }
  }

  return entries.flatMap((entry): FeedRow[] => {
    if (entry.kind === "activity") {
      return [{ kind: "activity", entry }];
    }
    if (entry.parentId !== null) {
      return []; // rendered under its parent
    }
    return [
      { kind: "thread", thread: { entry, replies: replies.get(entry.id) ?? [] } },
    ];
  });
}

export function commentCount(entries: readonly ActivityEntry[]): number {
  return entries.filter((entry) => entry.kind === "comment").length;
}
