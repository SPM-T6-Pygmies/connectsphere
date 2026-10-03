import {
  coordinatorAssignedMessage,
  type NotificationMessage,
} from "@/adapters/outbound/notification-content/coordinator-assigned";
import { organiserCoordinatorAssignedMessage } from "@/adapters/outbound/notification-content/organiser-coordinator-assigned";
import type {
  EventCoordinatorAssignedNotice,
  OrganiserCoordinatorAssignedNotice,
} from "@/core/ports/outbound/notifier";

/** A `notification` row as recorded before delivery: in-app, Pending, about one event request. */
export type NotificationRow = ReturnType<typeof eventRequestNotificationRow>;

function eventRequestNotificationRow(
  triggerScenario: string,
  notice: { readonly recipientUserAccountId: string; readonly eventRequestId: string },
  { subject, body }: NotificationMessage,
) {
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
