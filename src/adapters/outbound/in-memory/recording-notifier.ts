import type { Connection } from "@/core/domain/connection";
import type {
  ClarificationRequestedNotice,
  EventCoordinatorAssignedNotice,
  EventRequestDecidedNotice,
  Notifier,
  OrganiserCoordinatorAssignedNotice,
  SafetyCheckReadyNotice,
} from "@/core/ports/outbound/notifier";

export class RecordingNotifier implements Notifier {
  readonly sent: Connection[] = [];
  readonly coordinatorAssignments: EventCoordinatorAssignedNotice[] = [];
  readonly organiserCoordinatorAssignments: OrganiserCoordinatorAssignedNotice[] = [];
  readonly clarificationRequests: ClarificationRequestedNotice[] = [];
  readonly decisions: EventRequestDecidedNotice[] = [];
  readonly safetyChecksReady: SafetyCheckReadyNotice[] = [];

  async connectionRequested(connection: Connection): Promise<void> {
    this.sent.push(connection);
  }

  async eventCoordinatorAssigned(notice: EventCoordinatorAssignedNotice): Promise<void> {
    this.coordinatorAssignments.push(notice);
  }

  async organiserCoordinatorAssigned(notice: OrganiserCoordinatorAssignedNotice): Promise<void> {
    this.organiserCoordinatorAssignments.push(notice);
  }

  async clarificationRequested(notice: ClarificationRequestedNotice): Promise<void> {
    this.clarificationRequests.push(notice);
  }

  async eventRequestDecided(notice: EventRequestDecidedNotice): Promise<void> {
    this.decisions.push(notice);
  }

  async safetyCheckReady(notice: SafetyCheckReadyNotice): Promise<void> {
    this.safetyChecksReady.push(notice);
  }
}
