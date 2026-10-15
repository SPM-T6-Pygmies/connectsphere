import type { NotificationMessage } from "@/adapters/outbound/notification-content/coordinator-assigned";
import type { OrganiserMessagePostedNotice } from "@/core/ports/outbound/notifier";

/**
 * The words a Coordinator reads when the Organiser posts on a request assigned
 * to them (SPM-164): which request, and what the Organiser wrote (AC2).
 * Shared by the Novu in-app step and the copy kept in the `notification` table.
 */
export function organiserMessagePostedMessage(
  notice: OrganiserMessagePostedNotice,
): NotificationMessage {
  return {
    subject: `${notice.eventName} has a message from the organiser`,
    body: `The organiser wrote on ${notice.eventName}: "${notice.message}"`,
  };
}
