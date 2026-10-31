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
  | "Organiser message"
  | "Request decided"
  | "Ready for safety check"
  | "Safety check outcome"
  | "Booking requested"
  | "Booking decided"
  | "Booking cancelled"
  | "Booking flagged"
  | "Equipment recorded"
  | "Equipment decided"
  | "Event confirmed"
  | "Change requested"
  | "Change request decided"
  | "Event rescheduled"
  | "Event cancelled"
  | "Registration opened"
  | "Capacity reached"
  | "Availability changed";
