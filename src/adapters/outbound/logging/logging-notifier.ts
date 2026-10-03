import type { Connection } from "@/core/domain/connection";
import type {
  ClarificationRequestedNotice,
  EventCoordinatorAssignedNotice,
  Notifier,
  OrganiserCoordinatorAssignedNotice,
} from "@/core/ports/outbound/notifier";

/**
 * Placeholder driven adapter until a real delivery channel exists.
 *
 * Worth noticing: shipping without notifications did not require the core to
 * know that notifications were unfinished. Replacing this with an email or
 * push adapter touches this file and one line of `src/composition`.
 */
export class LoggingNotifier implements Notifier {
  async connectionRequested(connection: Connection): Promise<void> {
    console.info(
      `[notifier] connection requested ${connection.requesterId} -> ${connection.addresseeId}`,
    );
  }

  async eventCoordinatorAssigned(notice: EventCoordinatorAssignedNotice): Promise<void> {
    console.info(
      `[notifier] event request ${notice.eventRequestId} assigned to coordinator ${notice.recipientUserAccountId}`,
    );
  }

  async organiserCoordinatorAssigned(notice: OrganiserCoordinatorAssignedNotice): Promise<void> {
    console.info(
      `[notifier] organiser ${notice.recipientUserAccountId} told event request ${notice.eventRequestId} has a coordinator`,
    );
  }

  async clarificationRequested(notice: ClarificationRequestedNotice): Promise<void> {
    console.info(
      `[notifier] organiser ${notice.recipientUserAccountId} asked to clarify event request ${notice.eventRequestId}`,
    );
  }
}
