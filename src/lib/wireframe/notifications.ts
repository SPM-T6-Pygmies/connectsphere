/**
 * The §6 triggers a notification can come from.
 *
 * The inbox itself is fed from Novu (SPM-174); this is only the vocabulary its
 * trigger badge speaks, shared with the list pane's status set.
 */
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
