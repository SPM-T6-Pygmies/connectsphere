import type { Connection } from "@/core/domain/connection";
import type {
  EventCoordinatorAssignedNotice,
  Notifier,
  OrganiserCoordinatorAssignedNotice,
} from "@/core/ports/outbound/notifier";

export class RecordingNotifier implements Notifier {
  readonly sent: Connection[] = [];
  readonly coordinatorAssignments: EventCoordinatorAssignedNotice[] = [];
  readonly organiserCoordinatorAssignments: OrganiserCoordinatorAssignedNotice[] = [];

  async connectionRequested(connection: Connection): Promise<void> {
    this.sent.push(connection);
  }

  async eventCoordinatorAssigned(notice: EventCoordinatorAssignedNotice): Promise<void> {
    this.coordinatorAssignments.push(notice);
  }

  async organiserCoordinatorAssigned(notice: OrganiserCoordinatorAssignedNotice): Promise<void> {
    this.organiserCoordinatorAssignments.push(notice);
  }
}
