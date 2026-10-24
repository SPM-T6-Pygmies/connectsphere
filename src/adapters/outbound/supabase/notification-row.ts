import {
  coordinatorAssignedMessage,
  type NotificationMessage,
} from "@/adapters/outbound/notification-content/coordinator-assigned";
import { clarificationRequestedMessage } from "@/adapters/outbound/notification-content/clarification-requested";
import { equipmentDecidedMessage } from "@/adapters/outbound/notification-content/equipment-decided";
import { equipmentNeedsAttentionMessage } from "@/adapters/outbound/notification-content/equipment-needs-attention";
import { eventConfirmedMessage } from "@/adapters/outbound/notification-content/event-confirmed";
import { eventRequestDecidedMessage } from "@/adapters/outbound/notification-content/event-request-decided";
import { holdExpiredMessage } from "@/adapters/outbound/notification-content/hold-expired";
import { organiserCoordinatorAssignedMessage } from "@/adapters/outbound/notification-content/organiser-coordinator-assigned";
import { organiserMessagePostedMessage } from "@/adapters/outbound/notification-content/organiser-message-posted";
import { safetyCheckReadyMessage } from "@/adapters/outbound/notification-content/safety-check-ready";
import { safetyCheckRecordedMessage } from "@/adapters/outbound/notification-content/safety-check-recorded";
import { venueBookingCancelledMessage } from "@/adapters/outbound/notification-content/venue-booking-cancelled";
import { venueBookingDecidedMessage } from "@/adapters/outbound/notification-content/venue-booking-decided";
import { venueBookingRequestedMessage } from "@/adapters/outbound/notification-content/venue-booking-requested";
import type {
  ClarificationRequestedNotice,
  EquipmentDecidedNotice,
  EquipmentNeedsAttentionNotice,
  EventConfirmedNotice,
  EventCoordinatorAssignedNotice,
  EventRequestDecidedNotice,
  HoldExpiredNotice,
  OrganiserCoordinatorAssignedNotice,
  OrganiserMessagePostedNotice,
  SafetyCheckReadyNotice,
  SafetyCheckRecordedNotice,
  VenueBookingCancelledNotice,
  VenueBookingDecidedNotice,
  VenueBookingRequestedNotice,
} from "@/core/ports/outbound/notifier";

/** A `notification` row as recorded before delivery: in-app, Pending, about one event request, event or booking. */
export interface NotificationRow {
  readonly recipient_user_account_id: string;
  readonly trigger_scenario: string;
  readonly channel: string;
  readonly status: string;
  readonly related_event_request_id?: string;
  readonly related_event_id?: string;
  readonly related_booking_id?: string;
  readonly message_content: string;
}

function eventRequestNotificationRow(
  triggerScenario: string,
  notice: { readonly recipientUserAccountId: string; readonly eventRequestId: string },
  { subject, body }: NotificationMessage,
): NotificationRow {
  return {
    recipient_user_account_id: notice.recipientUserAccountId,
    trigger_scenario: triggerScenario,
    channel: "in_app",
    status: "Pending",
    related_event_request_id: notice.eventRequestId,
    message_content: `${subject}\n${body}`,
  };
}

/** The `notification` row a coordinator assignment is recorded as, before delivery. */
export function coordinatorAssignedRow(notice: EventCoordinatorAssignedNotice): NotificationRow {
  return eventRequestNotificationRow(
    "coordinator-assigned",
    notice,
    coordinatorAssignedMessage(notice),
  );
}

/** The `notification` row telling an Organiser who their coordinator is (SPM-58). */
export function organiserCoordinatorAssignedRow(
  notice: OrganiserCoordinatorAssignedNotice,
): NotificationRow {
  return eventRequestNotificationRow(
    "organiser-coordinator-assigned",
    notice,
    organiserCoordinatorAssignedMessage(notice),
  );
}

/** The `notification` row telling an Organiser what their coordinator asked (SPM-59). */
export function clarificationRequestedRow(notice: ClarificationRequestedNotice): NotificationRow {
  return eventRequestNotificationRow(
    "clarification-requested",
    notice,
    clarificationRequestedMessage(notice),
  );
}

/** The `notification` row telling a Coordinator what the Organiser wrote (SPM-164). */
export function organiserMessagePostedRow(notice: OrganiserMessagePostedNotice): NotificationRow {
  return eventRequestNotificationRow(
    "organiser-message-posted",
    notice,
    organiserMessagePostedMessage(notice),
  );
}

/** The `notification` row telling an Organiser their request was approved or rejected (SPM-60). */
export function eventRequestDecidedRow(notice: EventRequestDecidedNotice): NotificationRow {
  return eventRequestNotificationRow(
    "event-request-decided",
    notice,
    eventRequestDecidedMessage(notice),
  );
}

/** The `notification` row telling a Safety Officer an event is ready for its check (SPM-262). */
export function safetyCheckReadyRow(notice: SafetyCheckReadyNotice): NotificationRow {
  const { subject, body } = safetyCheckReadyMessage(notice);
  return {
    recipient_user_account_id: notice.recipientUserAccountId,
    trigger_scenario: "safety-check-ready",
    channel: "in_app",
    status: "Pending",
    related_event_id: notice.eventId,
    message_content: `${subject}\n${body}`,
  };
}

/** The `notification` row telling a coordinator their event's safety check outcome (SPM-263). */
export function safetyCheckRecordedRow(notice: SafetyCheckRecordedNotice): NotificationRow {
  const { subject, body } = safetyCheckRecordedMessage(notice);
  return {
    recipient_user_account_id: notice.recipientUserAccountId,
    trigger_scenario: "safety-check-recorded",
    channel: "in_app",
    status: "Pending",
    related_event_id: notice.eventId,
    message_content: `${subject}\n${body}`,
  };
}

/** The `notification` row telling a Venue Staff member a venue was requested (SPM-61). */
export function venueBookingRequestedRow(notice: VenueBookingRequestedNotice): NotificationRow {
  const { subject, body } = venueBookingRequestedMessage(notice);
  return {
    recipient_user_account_id: notice.recipientUserAccountId,
    trigger_scenario: "venue-booking-requested",
    channel: "in_app",
    status: "Pending",
    related_booking_id: notice.bookingId,
    message_content: `${subject}\n${body}`,
  };
}

/** The `notification` row telling a Technical Support Staff member a line needs their attention (SPM-64). */
export function equipmentNeedsAttentionRow(notice: EquipmentNeedsAttentionNotice): NotificationRow {
  const { subject, body } = equipmentNeedsAttentionMessage(notice);
  return {
    recipient_user_account_id: notice.recipientUserAccountId,
    trigger_scenario: "equipment-needs-attention",
    channel: "in_app",
    status: "Pending",
    related_event_id: notice.eventId,
    message_content: `${subject}\n${body}`,
  };
}

/** The `notification` row telling a coordinator Technical Support have finished their event's equipment (SPM-65). */
export function equipmentDecidedRow(notice: EquipmentDecidedNotice): NotificationRow {
  const { subject, body } = equipmentDecidedMessage(notice);
  return {
    recipient_user_account_id: notice.recipientUserAccountId,
    trigger_scenario: "equipment-decided",
    channel: "in_app",
    status: "Pending",
    related_event_id: notice.eventId,
    message_content: `${subject}\n${body}`,
  };
}

/** The `notification` row telling a coordinator Venue Staff decided their booking (SPM-62). */
export function venueBookingDecidedRow(notice: VenueBookingDecidedNotice): NotificationRow {
  const { subject, body } = venueBookingDecidedMessage(notice);
  return {
    recipient_user_account_id: notice.recipientUserAccountId,
    trigger_scenario: "venue-booking-decided",
    channel: "in_app",
    status: "Pending",
    related_booking_id: notice.bookingId,
    message_content: `${subject}\n${body}`,
  };
}

/** The `notification` row telling a coordinator a hold on their event's venue expired (SPM-254). */
export function holdExpiredRow(notice: HoldExpiredNotice): NotificationRow {
  const { subject, body } = holdExpiredMessage(notice);
  return {
    recipient_user_account_id: notice.recipientUserAccountId,
    trigger_scenario: "hold-expired",
    channel: "in_app",
    status: "Pending",
    related_booking_id: notice.bookingId,
    message_content: `${subject}\n${body}`,
  };
}

/** The `notification` row telling Venue Staff a confirmed booking was cancelled (SPM-63). */
export function venueBookingCancelledRow(notice: VenueBookingCancelledNotice): NotificationRow {
  const { subject, body } = venueBookingCancelledMessage(notice);
  return {
    recipient_user_account_id: notice.recipientUserAccountId,
    trigger_scenario: "venue-booking-cancelled",
    channel: "in_app",
    status: "Pending",
    related_booking_id: notice.bookingId,
    message_content: `${subject}\n${body}`,
  };
}

/** The `notification` row telling an Organiser their event is confirmed (SPM-66). */
export function eventConfirmedRow(notice: EventConfirmedNotice): NotificationRow {
  const { subject, body } = eventConfirmedMessage(notice);
  return {
    recipient_user_account_id: notice.recipientUserAccountId,
    trigger_scenario: "event-confirmed",
    channel: "in_app",
    status: "Pending",
    related_event_id: notice.eventId,
    message_content: `${subject}\n${body}`,
  };
}
