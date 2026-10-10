import {
  coordinatorAssignedMessage,
  type NotificationMessage,
} from "@/adapters/outbound/notification-content/coordinator-assigned";
import { clarificationRequestedMessage } from "@/adapters/outbound/notification-content/clarification-requested";
import { eventRequestDecidedMessage } from "@/adapters/outbound/notification-content/event-request-decided";
import { organiserCoordinatorAssignedMessage } from "@/adapters/outbound/notification-content/organiser-coordinator-assigned";
import { safetyCheckReadyMessage } from "@/adapters/outbound/notification-content/safety-check-ready";
import { safetyCheckRecordedMessage } from "@/adapters/outbound/notification-content/safety-check-recorded";
import type {
  ClarificationRequestedNotice,
  EventCoordinatorAssignedNotice,
  EventRequestDecidedNotice,
  OrganiserCoordinatorAssignedNotice,
  SafetyCheckReadyNotice,
  SafetyCheckRecordedNotice,
} from "@/core/ports/outbound/notifier";

/** A `notification` row as recorded before delivery: in-app, Pending, about one event request or one event. */
export interface NotificationRow {
  readonly recipient_user_account_id: string;
  readonly trigger_scenario: string;
  readonly channel: string;
  readonly status: string;
  readonly related_event_request_id?: string;
  readonly related_event_id?: string;
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
