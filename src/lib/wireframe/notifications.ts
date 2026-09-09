/**
 * Seeded notifications for the inbox wireframe.
 *
 * Each row is one trigger from brief §6's fourteen scenarios, addressed to the
 * role the wiki's recipient matrix assigns it to, and carrying the card that
 * matrix maps it to. The matrix is the team's proposal rather than customer
 * text -- §6 names the trigger only, never the recipient -- so the card
 * reference is shown in the inbox instead of being quietly implied.
 *
 * A notification points at a record; it does not restate it. Every row links
 * to the screen that owns the thing that changed.
 */

import type { StaffRole } from "./types";

/** The §6 trigger this notification came from. */
export type NotificationTrigger =
  | "Request submitted"
  | "Coordinator assigned"
  | "Clarification requested"
  | "Request decided"
  | "Booking requested"
  | "Booking decided"
  | "Equipment recorded"
  | "Equipment decided"
  | "Event confirmed"
  | "Change requested"
  | "Event rescheduled"
  | "Registration opened"
  | "Capacity reached"
  | "Availability changed";

/** Which detail view an inbox row opens. */
export type NotificationTargetKind =
  | "request"
  | "assign"
  | "event"
  | "booking"
  | "reservation";

export interface NotificationRecord {
  readonly id: string;
  /** Who this is addressed to. */
  readonly recipient: StaffRole;
  readonly trigger: NotificationTrigger;
  readonly subject: string;
  readonly body: string;
  /** The event this concerns, for grouping. */
  readonly eventName: string;
  /** The screen that owns what changed. */
  readonly href: string;
  /** The record to open in the main pane when read from the inbox. */
  readonly target: { readonly kind: NotificationTargetKind; readonly id: string; readonly tab?: string };
  readonly receivedAt: string;
  readonly unread: boolean;
  /** The backlog card in the wiki's recipient matrix that covers this row. */
  readonly card: string;
}

export const NOTIFICATIONS: readonly NotificationRecord[] = [
  // --- Event Operations Manager (SPM-56) -----------------------------------
  {
    id: "n-01",
    recipient: "ops",
    trigger: "Request submitted",
    subject: "Annual Client Forum needs a coordinator",
    body: "Priya Raman submitted a request for 240 people on 10 December. No coordinator is assigned yet.",
    eventName: "Annual Client Forum",
    href: "/staff/ops/e-03",
    target: { kind: "assign", id: "e-03" },
    receivedAt: "2026-09-08 09:14",
    unread: true,
    card: "SPM-56",
  },

  // --- Event Organiser (SPM-58, 59, 60, 66, 68) ---------------------------
  {
    id: "n-02",
    recipient: "requester",
    trigger: "Clarification requested",
    subject: "Amara Sithole asked you a question",
    body: "Can you confirm whether the streamed sessions need live interpretation as well as captions?",
    eventName: "Hybrid Leadership Summit",
    href: "/staff/requester/e-04",
    target: { kind: "request", id: "e-04" },
    receivedAt: "2026-09-06 14:22",
    unread: true,
    card: "SPM-59",
  },
  {
    id: "n-03",
    recipient: "requester",
    trigger: "Coordinator assigned",
    subject: "Amara Sithole is coordinating your event",
    body: "She is now your main point of contact for the Hybrid Leadership Summit.",
    eventName: "Hybrid Leadership Summit",
    href: "/staff/requester/e-04",
    target: { kind: "request", id: "e-04" },
    receivedAt: "2026-09-02 11:05",
    unread: false,
    card: "SPM-58",
  },
  {
    id: "n-04",
    recipient: "requester",
    trigger: "Event confirmed",
    subject: "Autumn Product Showcase is confirmed",
    body: "Venue, equipment and technical support are all in place. You can now see the confirmed arrangements.",
    eventName: "Autumn Product Showcase",
    href: "/staff/requester/e-06",
    target: { kind: "request", id: "e-06" },
    receivedAt: "2026-09-01 16:40",
    unread: false,
    card: "SPM-66",
  },
  {
    id: "n-05",
    recipient: "requester",
    trigger: "Request decided",
    subject: "Compliance Training Workshop was approved",
    body: "Jonas Berg approved the request on 6 September. Planning can now proceed — nothing is booked yet.",
    eventName: "Compliance Training Workshop",
    href: "/staff/requester/e-07",
    target: { kind: "request", id: "e-07" },
    receivedAt: "2026-09-06 10:02",
    unread: false,
    card: "SPM-60",
  },

  // --- Event Coordinator (SPM-57, 62, 65, 72) -----------------------------
  {
    id: "n-06",
    recipient: "coordinator",
    trigger: "Equipment decided",
    subject: "Stage lighting rig is unavailable",
    body: "Both rigs are out for inspection until 22 November. Three of four video-conferencing kits were reserved.",
    eventName: "Hybrid Leadership Summit",
    href: "/staff/coordinator/e-04?tab=technical",
    target: { kind: "event", id: "e-04", tab: "technical" },
    receivedAt: "2026-09-07 15:30",
    unread: true,
    card: "SPM-65",
  },
  {
    id: "n-07",
    recipient: "coordinator",
    trigger: "Booking decided",
    subject: "Hall A rejected the Graduate Open Day booking",
    body: "Committed to a contracted client for 2 October. Innovation Suite was suggested instead.",
    eventName: "Graduate Recruitment Open Day",
    href: "/staff/coordinator/e-05?tab=venue",
    target: { kind: "event", id: "e-05", tab: "venue" },
    receivedAt: "2026-09-04 09:47",
    unread: true,
    card: "SPM-62",
  },
  {
    id: "n-08",
    recipient: "coordinator",
    trigger: "Coordinator assigned",
    subject: "You were assigned to Hybrid Leadership Summit",
    body: "Daniel Okonkwo assigned this to you. There is no acceptance step — it is yours now.",
    eventName: "Hybrid Leadership Summit",
    href: "/staff/coordinator/e-04",
    target: { kind: "event", id: "e-04" },
    receivedAt: "2026-09-02 11:05",
    unread: false,
    card: "SPM-57",
  },
  {
    id: "n-09",
    recipient: "coordinator",
    trigger: "Capacity reached",
    subject: "Autumn Product Showcase is filling up",
    body: "3 of 120 places taken. This is the notification that fires when the cap is reached.",
    eventName: "Autumn Product Showcase",
    href: "/staff/coordinator/e-06?tab=registration",
    target: { kind: "event", id: "e-06", tab: "registration" },
    receivedAt: "2026-09-05 08:15",
    unread: false,
    card: "SPM-72",
  },

  // --- Venue Staff (SPM-61, 63) -------------------------------------------
  {
    id: "n-10",
    recipient: "venue",
    trigger: "Booking requested",
    subject: "Hall A requested for 18 November",
    body: "Amara Sithole requested AM + PM for the Hybrid Leadership Summit, 180 expected.",
    eventName: "Hybrid Leadership Summit",
    href: "/staff/venue/b-02",
    target: { kind: "booking", id: "b-02" },
    receivedAt: "2026-09-07 10:20",
    unread: true,
    card: "SPM-61",
  },
  {
    id: "n-11",
    recipient: "venue",
    trigger: "Booking requested",
    subject: "Seminar Room 3 requested for 3 December",
    body: "Jonas Berg requested the AM slot for the Compliance Training Workshop, 38 expected.",
    eventName: "Compliance Training Workshop",
    href: "/staff/venue/b-04",
    target: { kind: "booking", id: "b-04" },
    receivedAt: "2026-09-08 13:55",
    unread: true,
    card: "SPM-61",
  },

  // --- Technical Support Staff (SPM-64) -----------------------------------
  {
    id: "n-12",
    recipient: "technical",
    trigger: "Equipment recorded",
    subject: "Equipment recorded for Compliance Training Workshop",
    body: "One projector and two microphones requested for 3 December. Not yet reviewed.",
    eventName: "Compliance Training Workshop",
    href: "/staff/technical/er-03",
    target: { kind: "reservation", id: "er-03" },
    receivedAt: "2026-09-06 11:30",
    unread: true,
    card: "SPM-64",
  },
  {
    id: "n-13",
    recipient: "technical",
    trigger: "Equipment recorded",
    subject: "Requirements changed for Hybrid Leadership Summit",
    body: "The coordinator added a stage lighting rig to the existing request.",
    eventName: "Hybrid Leadership Summit",
    href: "/staff/technical/er-02",
    target: { kind: "reservation", id: "er-02" },
    receivedAt: "2026-09-05 16:12",
    unread: false,
    card: "SPM-64",
  },
];

export function notificationsFor(role: StaffRole): NotificationRecord[] {
  return NOTIFICATIONS.filter(
    (notification) => notification.recipient === role,
  );
}

export function unreadCount(role: StaffRole): number {
  return notificationsFor(role).filter(
    (notification) => notification.unread,
  ).length;
}
