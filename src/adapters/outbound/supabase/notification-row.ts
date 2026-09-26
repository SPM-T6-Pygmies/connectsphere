import { coordinatorAssignedMessage } from "@/adapters/outbound/notification-content/coordinator-assigned";
import type { EventCoordinatorAssignedNotice } from "@/core/ports/outbound/notifier";

/** The `notification` row a coordinator assignment is recorded as, before delivery. */
export function coordinatorAssignedRow(notice: EventCoordinatorAssignedNotice) {
  const { subject, body } = coordinatorAssignedMessage(notice);
  return {
    recipient_user_account_id: notice.recipientUserAccountId,
    trigger_scenario: "coordinator-assigned",
    channel: "in_app",
    status: "Pending",
    related_event_request_id: notice.eventRequestId,
    message_content: `${subject}\n${body}`,
  };
}
