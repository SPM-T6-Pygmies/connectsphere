import { clientOrganisationId } from "@/core/domain/client-organisation";
import type { CoordinatorEvent } from "@/core/domain/coordinator-event";
import { CoordinatorEventNotFoundError } from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import type { OrdinaryEventChanges } from "@/core/domain/event-details-edit";
import { userAccountId, type UserAccountId } from "@/core/domain/user-account";
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
  readonly description: string | null;
  readonly expectedAttendance: number | null;
  /** The Organiser's stated equipment needs (SPM-41 AC6); optional so a seed that does not care can omit it. */
  readonly statedEquipmentNeeds?: string | null;
  readonly clientOrganisationId: string;
  readonly owningOrganiserUserAccountId: string;
}

function toDetails(event: SeedCoordinatorEvent): CoordinatorEventDetails {
  return {
    id: event.id,
    eventRequestId: event.eventRequestId,
    name: event.name,
    status: event.status,
    preferredDate: event.preferredDate,
    slots: event.slots ?? [],
    expectedAttendance: event.expectedAttendance ?? null,
    venueRequirements: event.venueRequirements ?? null,
    roomLayoutPreference: event.roomLayoutPreference ?? null,
    accessibilityRequirements: event.accessibilityRequirements ?? null,
    requiredFacilities: event.requiredFacilities ?? null,
    description: event.description,
    purpose: event.purpose ?? null,
    categoryType: event.categoryType ?? null,
    programmeAgenda: event.programmeAgenda ?? null,
    specialArrangements: event.specialArrangements ?? null,
    operationalNotes: event.operationalNotes ?? null,
  };
}

/** One audited change, as `coordinator_update_event_details` writes it to `audit_record`. */
export interface AuditedEventChange {
  readonly actorUserAccountId: string;
  readonly eventId: string;
  readonly field: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
}

/** One audited action on an event, as `coordinator_complete_event` writes it to `audit_record`. */
export interface AuditedEventAction {
  readonly actorUserAccountId: string;
  readonly eventId: string;
  readonly action: string;
}

export class InMemoryCoordinatorEventRepository implements CoordinatorEventRepository {
  private readonly rows: SeedCoordinatorEvent[];
  private readonly audit: AuditedEventChange[] = [];
  private readonly activity: AuditedEventAction[] = [];

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

  async findAssignedById(
    coordinatorId: UserAccountId,
    id: CoordinatorEvent["id"],
  ): Promise<CoordinatorEvent | null> {
    const row = this.rows.find(
      (event) => event.id === id && event.assignedCoordinatorUserAccountId === coordinatorId,
    );
    if (row === undefined) {
      return null;
    }
    return toCoordinatorEvent(row);
  }

  /** Stores the facilities. The audit record it writes for real is not modelled in memory. */
  async setRequiredFacilities(
    coordinatorId: UserAccountId,
    eventId: string,
    facilities: string | null,
  ): Promise<void> {
    const index = this.rows.findIndex(
      (row) => row.id === eventId && row.assignedCoordinatorUserAccountId === coordinatorId,
    );
    if (index === -1) {
      throw new CoordinatorEventNotFoundError(eventId);
    }
    this.rows[index] = { ...this.rows[index], requiredFacilities: facilities };
  }

  /** Stores the changes and, as the database does, audits each one against the coordinator. */
  async updateOrdinaryDetails(
    coordinatorId: UserAccountId,
    eventId: string,
    changes: OrdinaryEventChanges,
  ): Promise<void> {
    const index = this.rows.findIndex(
      (row) => row.id === eventId && row.assignedCoordinatorUserAccountId === coordinatorId,
    );
    if (index === -1) {
      throw new CoordinatorEventNotFoundError(eventId);
    }
    const before = toDetails(this.rows[index]);
    for (const [field, newValue] of Object.entries(changes)) {
      this.audit.push({
        actorUserAccountId: coordinatorId,
        eventId,
        field,
        oldValue: before[field as keyof OrdinaryEventChanges] ?? null,
        newValue: newValue ?? null,
      });
    }
    this.rows[index] = { ...this.rows[index], ...changes };
  }

  /** Test-only window on the field changes `updateOrdinaryDetails` and `completeEvent` audited. */
  auditTrail(): readonly AuditedEventChange[] {
    return [...this.audit];
  }

  /** Stores the confirmed status. The audit record it writes for real is not modelled in memory. */
  async confirmEvent(event: CoordinatorEvent): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === event.id);
    if (index === -1) {
      return;
    }
    this.rows[index] = { ...this.rows[index], status: event.status };
  }

  /**
   * Stores the Completed status and any new notes and, as the database does, audits the
   * completion and the notes change against the coordinator. The status and end checks
   * the database restates are the domain's, already made.
   */
  async completeEvent(coordinatorId: UserAccountId, eventId: string, notes: string | null): Promise<void> {
    const index = this.rows.findIndex(
      (row) => row.id === eventId && row.assignedCoordinatorUserAccountId === coordinatorId,
    );
    if (index === -1) {
      throw new CoordinatorEventNotFoundError(eventId);
    }
    const before = this.rows[index];
    this.activity.push({ actorUserAccountId: coordinatorId, eventId, action: "completed" });
    if (notes !== null) {
      this.audit.push({
        actorUserAccountId: coordinatorId,
        eventId,
        field: "operationalNotes",
        oldValue: before.operationalNotes ?? null,
        newValue: notes,
      });
    }
    this.rows[index] = {
      ...before,
      status: "Completed",
      ...(notes === null ? {} : { operationalNotes: notes }),
    };
  }

  /** Test-only window on the actions `completeEvent` audited. */
  activityTrail(): readonly AuditedEventAction[] {
    return [...this.activity];
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
    statedEquipmentNeeds: row.statedEquipmentNeeds ?? null,
    clientOrganisationId: clientOrganisationId(row.clientOrganisationId),
    owningOrganiserUserAccountId: userAccountId(row.owningOrganiserUserAccountId),
    assignedCoordinatorUserAccountId:
      row.assignedCoordinatorUserAccountId === null
        ? null
        : userAccountId(row.assignedCoordinatorUserAccountId),
  };
}
