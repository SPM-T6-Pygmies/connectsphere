import { clientOrganisationId } from "@/core/domain/client-organisation";
import type { CoordinatorEvent } from "@/core/domain/coordinator-event";
import { eventId } from "@/core/domain/event";
import { userAccountId, type UserAccountId } from "@/core/domain/user-account";
import type {
  AssignedEventSummary,
  CoordinatorEventRepository,
} from "@/core/ports/outbound/coordinator-event-repository";

/** An event as seeded: the view, plus the fields only `findById`/`confirmEvent` need. */
export interface SeedCoordinatorEvent extends AssignedEventSummary {
  readonly assignedCoordinatorUserAccountId: string | null;
  readonly description: string | null;
  readonly expectedAttendance: number | null;
  readonly clientOrganisationId: string;
  readonly owningOrganiserUserAccountId: string;
}

export class InMemoryCoordinatorEventRepository implements CoordinatorEventRepository {
  private readonly rows: SeedCoordinatorEvent[];

  constructor(seed: readonly SeedCoordinatorEvent[] = []) {
    this.rows = [...seed];
  }

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

  async findById(id: CoordinatorEvent["id"]): Promise<CoordinatorEvent | null> {
    const row = this.rows.find((event) => event.id === id);
    if (row === undefined) {
      return null;
    }
    return toCoordinatorEvent(row);
  }

  /** Stores the confirmed status. The audit record it writes for real is not modelled in memory. */
  async confirmEvent(event: CoordinatorEvent): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === event.id);
    if (index === -1) {
      return;
    }
    this.rows[index] = { ...this.rows[index], status: event.status };
  }

  /** Test-only window on what was stored, so a test can assert a status change. */
  all(): readonly SeedCoordinatorEvent[] {
    return [...this.rows];
  }
}

function toCoordinatorEvent(row: SeedCoordinatorEvent): CoordinatorEvent {
  return {
    id: eventId(row.id),
    name: row.name,
    description: row.description,
    status: row.status,
    preferredDate: row.preferredDate,
    expectedAttendance: row.expectedAttendance,
    clientOrganisationId: clientOrganisationId(row.clientOrganisationId),
    owningOrganiserUserAccountId: userAccountId(row.owningOrganiserUserAccountId),
    assignedCoordinatorUserAccountId:
      row.assignedCoordinatorUserAccountId === null
        ? null
        : userAccountId(row.assignedCoordinatorUserAccountId),
  };
}
