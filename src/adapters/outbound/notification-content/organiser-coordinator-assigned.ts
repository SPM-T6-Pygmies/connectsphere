import type { NotificationMessage } from "@/adapters/outbound/notification-content/coordinator-assigned";
import type { OrganiserCoordinatorAssignedNotice } from "@/core/ports/outbound/notifier";

/**
 * The words an Organiser reads when a coordinator is assigned to their request,
 * or it is reassigned to another (SPM-58): who their point of contact at
 * ConnectSphere now is (brief §2). Shared by the Novu in-app step and the copy
 * kept in the `notification` table.
 */
export function organiserCoordinatorAssignedMessage(
  notice: OrganiserCoordinatorAssignedNotice,
): NotificationMessage {
  const coordinator = notice.coordinatorName ?? "A coordinator";

  return {
    subject:
      notice.coordinatorName === null
        ? `${notice.eventName} has a coordinator`
        : `${notice.coordinatorName} is coordinating ${notice.eventName}`,
    body: `${coordinator} is now your point of contact at ConnectSphere for ${notice.eventName}.`,
  };
}
