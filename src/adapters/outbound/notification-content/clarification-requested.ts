import type { NotificationMessage } from "@/adapters/outbound/notification-content/coordinator-assigned";
import type { ClarificationRequestedNotice } from "@/core/ports/outbound/notifier";

/**
 * The words an Organiser reads when their coordinator returns the request with
 * a question (SPM-59): that it is waiting on them, and what was asked (AC2).
 * Shared by the Novu in-app step and the copy kept in the `notification` table.
 */
export function clarificationRequestedMessage(
  notice: ClarificationRequestedNotice,
): NotificationMessage {
  return {
    subject: `${notice.eventName} needs clarification`,
    body: `Your coordinator returned ${notice.eventName} with a question: "${notice.message}"`,
  };
}
