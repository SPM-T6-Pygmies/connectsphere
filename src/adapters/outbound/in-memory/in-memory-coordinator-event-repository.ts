import type { UserAccountId } from "@/core/domain/user-account";
import type {
  AssignedEventSummary,
  CoordinatorEventDetails,
  CoordinatorEventRepository,
} from "@/core/ports/outbound/coordinator-event-repository";

/**
 * An event as seeded: the list view, plus who it is assigned to so reads can
 * be scoped. The detail fields a booking page shows are optional so a seed
 * that only feeds "My events" does not have to spell them out.
 */
export interface SeedCoordinatorEvent
  extends AssignedEventSummary,
    Partial<Omit<CoordinatorEventDetails, keyof AssignedEventSummary>> {
  readonly assignedCoordinatorUserAccountId: string | null;
}

function toDetails(event: SeedCoordinatorEvent): CoordinatorEventDetails {
  return {
    id: event.id,
    eventRequestId: event.eventRequestId,
    name: event.name,
    status: event.status,
    preferredDate: event.preferredDate,
    startTime: event.startTime ?? null,
    endTime: event.endTime ?? null,
    expectedAttendance: event.expectedAttendance ?? null,
    venueRequirements: event.venueRequirements ?? null,
    roomLayoutPreference: event.roomLayoutPreference ?? null,
    accessibilityRequirements: event.accessibilityRequirements ?? null,
  };
}

export class InMemoryCoordinatorEventRepository implements CoordinatorEventRepository {
  constructor(private readonly rows: readonly SeedCoordinatorEvent[] = []) {}

  async listByAssignedCoordinator(
    coordinatorId: UserAccountId,
  ): Promise<readonly AssignedEventSummary[]> {
    return this.rows
      .filter((event) => event.assignedCoordinatorUserAccountId === coordinatorId)
      .map(({ id, eventRequestId, name, clientOrganisationName, preferredDate, status }) => ({
        id,
        eventRequestId,
        name,
        clientOrganisationName,
        preferredDate,
        status,
      }));
  }

  async findAssigned(
    coordinatorId: UserAccountId,
    eventId: string,
  ): Promise<CoordinatorEventDetails | null> {
    const event = this.rows.find(
      (row) => row.id === eventId && row.assignedCoordinatorUserAccountId === coordinatorId,
    );
    return event === undefined ? null : toDetails(event);
  }

  async findAssignedByRequest(
    coordinatorId: UserAccountId,
    eventRequestId: string,
  ): Promise<CoordinatorEventDetails | null> {
    const event = this.rows.find(
      (row) =>
        row.eventRequestId === eventRequestId &&
        row.assignedCoordinatorUserAccountId === coordinatorId,
    );
    return event === undefined ? null : toDetails(event);
  }
}
