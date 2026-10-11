import type { CoordinatorEvent } from "@/core/domain/coordinator-event";
import {
  CoordinatorEventNotFoundError,
  EventDetailsLockedError,
  EventFacilitiesLockedError,
  EventNotCompletableError,
  EventNotConfirmableError,
  EventNotFoundError,
  EventNotReadyForConfirmationError,
  EventNotYetEndedError,
  EventRegistrationLockedError,
  InvalidRegistrationSettingsError,
} from "@/core/domain/errors";
import type { RegistrationSettings } from "@/core/domain/event-registration-settings";
import {
  assessReadiness,
  blockingArrangements,
  type ArrangementType,
} from "@/core/domain/event-readiness";
import type { OrdinaryEventChanges } from "@/core/domain/event-details-edit";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  AssignedEventSummary,
  CoordinatorEventDetails,
  CoordinatorEventRepository,
} from "@/core/ports/outbound/coordinator-event-repository";

import type { SupabaseServerClient } from "./client";
import { SupabaseEventReadinessRepository } from "./supabase-event-readiness-repository";
import {
  EVENT_SLOTS_SELECT,
  toAssignedEventSummary,
  toCoordinatorEvent,
  toCoordinatorEventDetails,
  toKey,
  toOrdinaryChangesPayload,
  toRegistrationSettingsArgs,
  type CoordinatorEventDetailsRow,
  type CoordinatorEventRecordRow,
  type CoordinatorEventRow,
} from "./coordinator-event-mapper";

interface ClientOrganisationNameRow {
  client_organisation_id: number;
  name: string;
}

/** SQLSTATEs `coordinator_confirm_event` comes back with. See its migration. */
const NOT_FOUND_OR_NOT_ASSIGNED = "CS020";
const NOT_CONFIRMABLE = "CS021";
const NOT_READY = "CS022";

/** SQLSTATEs `coordinator_set_event_required_facilities` comes back with. See its migration. */
const FACILITIES_EVENT_NOT_FOUND = "CS029";
const FACILITIES_EVENT_LOCKED = "CS043";

/** SQLSTATEs `coordinator_update_event_details` comes back with. See its migration. */
const DETAILS_EVENT_NOT_FOUND = "CS064";
const DETAILS_EVENT_LOCKED = "CS065";

/** SQLSTATEs `coordinator_set_event_registration` comes back with. See its migration. */
const REGISTRATION_EVENT_NOT_FOUND = "CS067";
const REGISTRATION_EVENT_LOCKED = "CS068";
const REGISTRATION_INVALID = "CS069";

/** SQLSTATEs `coordinator_complete_event` comes back with. See its migration. */
const COMPLETE_EVENT_NOT_FOUND = "CS070";
const COMPLETE_NOT_COMPLETABLE = "CS071";
const COMPLETE_NOT_ENDED = "CS072";

/**
 * Reached through `coordinator_events`, not the table -- the table's own
 * grant/policy is scoped to the Attendee's read (see `event-mapper.ts`),
 * which neither carries the columns nor allows the rows a coordinator needs.
 */
export class SupabaseCoordinatorEventRepository implements CoordinatorEventRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async listByAssignedCoordinator(
    coordinatorId: UserAccountId,
  ): Promise<readonly AssignedEventSummary[]> {
    const key = toKey(coordinatorId);
    if (key === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("coordinator_events", {
      p_coordinator_user_account_id: key,
    });

    if (error) {
      throw new Error(`Failed to list assigned events: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as CoordinatorEventRow[];
    const organisationNames = await this.organisationNames(
      rows.map((row) => row.client_organisation_id),
    );
    return rows.map((row) => toAssignedEventSummary(row, organisationNames));
  }

  async findAssigned(
    coordinatorId: UserAccountId,
    eventId: string,
  ): Promise<CoordinatorEventDetails | null> {
    const row = (await this.assignedRows(coordinatorId)).find(
      (candidate) => String(candidate.event_id) === eventId,
    );
    return row === undefined ? null : toCoordinatorEventDetails(row);
  }

  async findAssignedByRequest(
    coordinatorId: UserAccountId,
    eventRequestId: string,
  ): Promise<CoordinatorEventDetails | null> {
    const row = (await this.assignedRows(coordinatorId)).find(
      (candidate) =>
        candidate.event_request_id !== null && String(candidate.event_request_id) === eventRequestId,
    );
    return row === undefined ? null : toCoordinatorEventDetails(row);
  }

  /**
   * Every event assigned to the coordinator, through the same function "My
   * events" reads -- a coordinator has few enough events that filtering here
   * costs less than a second function to keep in step with the first.
   */
  private async assignedRows(
    coordinatorId: UserAccountId,
  ): Promise<readonly CoordinatorEventDetailsRow[]> {
    const key = toKey(coordinatorId);
    if (key === null) {
      return [];
    }

    const { data, error } = await this.client
      .rpc("coordinator_events", { p_coordinator_user_account_id: key })
      .select(EVENT_SLOTS_SELECT);
    if (error) {
      throw new Error(`Failed to read assigned events: ${error.message}`, { cause: error });
    }
    return (data ?? []) as unknown as CoordinatorEventDetailsRow[];
  }

  /** Through `coordinator_event`, not the table -- same reason as `listByAssignedCoordinator` above. */
  async findAssignedById(
    coordinatorId: UserAccountId,
    id: CoordinatorEvent["id"],
  ): Promise<CoordinatorEvent | null> {
    const key = toKey(id);
    const coordinatorKey = toKey(coordinatorId);
    if (key === null || coordinatorKey === null) {
      return null;
    }

    const { data, error } = await this.client.rpc("coordinator_event", {
      p_event_id: key,
      p_coordinator_user_account_id: coordinatorKey,
    });

    if (error) {
      throw new Error(`Failed to look up event: ${error.message}`, { cause: error });
    }

    const row = data as unknown as CoordinatorEventRecordRow | null;
    // Single-row (not `setof`) function: a miss comes back as one row of
    // nulls rather than SQL NULL, same quirk `organiser_event_request` has.
    return row && row.event_id !== null ? toCoordinatorEvent(row) : null;
  }

  /**
   * SPM-247: goes through `coordinator_set_event_required_facilities`, which
   * re-checks the assignment and status under a row lock and audits the change
   * in the same transaction. Its SQLSTATEs come back as the domain's own errors.
   */
  async setRequiredFacilities(
    coordinatorId: UserAccountId,
    eventId: string,
    facilities: string | null,
  ): Promise<void> {
    const eventKey = toKey(eventId);
    const coordinatorKey = toKey(coordinatorId);
    if (eventKey === null || coordinatorKey === null) {
      throw new CoordinatorEventNotFoundError(eventId);
    }

    const { error } = await this.client.rpc("coordinator_set_event_required_facilities", {
      p_coordinator_user_account_id: coordinatorKey,
      p_event_id: eventKey,
      p_facilities: facilities,
    });

    if (error) {
      if (error.code === FACILITIES_EVENT_NOT_FOUND) {
        throw new CoordinatorEventNotFoundError(eventId);
      }
      if (error.code === FACILITIES_EVENT_LOCKED) {
        throw new EventFacilitiesLockedError(error.details || "closed");
      }
      throw new Error(`Failed to save the event's facilities: ${error.message}`, { cause: error });
    }
  }

  /**
   * SPM-49: goes through `coordinator_update_event_details`, which re-checks
   * the assignment and status under a row lock, accepts only the ordinary
   * columns, and audits each change in the same transaction.
   */
  async updateOrdinaryDetails(
    coordinatorId: UserAccountId,
    eventId: string,
    changes: OrdinaryEventChanges,
  ): Promise<void> {
    const eventKey = toKey(eventId);
    const coordinatorKey = toKey(coordinatorId);
    if (eventKey === null || coordinatorKey === null) {
      throw new CoordinatorEventNotFoundError(eventId);
    }

    const { error } = await this.client.rpc("coordinator_update_event_details", {
      p_coordinator_user_account_id: coordinatorKey,
      p_event_id: eventKey,
      p_changes: toOrdinaryChangesPayload(changes),
    });

    if (error) {
      if (error.code === DETAILS_EVENT_NOT_FOUND) {
        throw new CoordinatorEventNotFoundError(eventId);
      }
      if (error.code === DETAILS_EVENT_LOCKED) {
        throw new EventDetailsLockedError(error.details || "closed");
      }
      throw new Error(`Failed to save the event's details: ${error.message}`, { cause: error });
    }
  }

  /**
   * SPM-25: goes through `coordinator_set_event_registration`, which re-checks
   * the assignment, status and window under a row lock, and audits each
   * changed setting in the same transaction.
   */
  async setRegistrationSettings(
    coordinatorId: UserAccountId,
    eventId: string,
    settings: RegistrationSettings,
  ): Promise<void> {
    const eventKey = toKey(eventId);
    const coordinatorKey = toKey(coordinatorId);
    if (eventKey === null || coordinatorKey === null) {
      throw new CoordinatorEventNotFoundError(eventId);
    }

    const { error } = await this.client.rpc("coordinator_set_event_registration", {
      p_coordinator_user_account_id: coordinatorKey,
      p_event_id: eventKey,
      ...toRegistrationSettingsArgs(settings),
    });

    if (error) {
      if (error.code === REGISTRATION_EVENT_NOT_FOUND) {
        throw new CoordinatorEventNotFoundError(eventId);
      }
      if (error.code === REGISTRATION_EVENT_LOCKED) {
        throw new EventRegistrationLockedError(error.details || "closed");
      }
      if (error.code === REGISTRATION_INVALID) {
        throw new InvalidRegistrationSettingsError(
          "Set both the opening and closing dates to enable registration, opening on or before it closes.",
        );
      }
      throw new Error(`Failed to save the event's registration settings: ${error.message}`, { cause: error });
    }
  }

  /**
   * SPM-50: goes through `coordinator_confirm_event`, which re-checks the
   * assignment, status and readiness under a row lock, and -- in the same
   * transaction -- writes the audit record. Its SQLSTATEs come back as the
   * domain's own errors, so losing a race to a concurrent change reads
   * exactly like losing it a moment earlier, rather than a 500.
   */
  async confirmEvent(event: CoordinatorEvent, confirmedBy: UserAccountId): Promise<void> {
    const eventKey = toKey(event.id);
    const coordinatorKey = toKey(confirmedBy);
    if (eventKey === null || coordinatorKey === null) {
      throw new Error(`Cannot confirm event with malformed ids "${event.id}" and "${confirmedBy}".`);
    }

    const { error } = await this.client.rpc("coordinator_confirm_event", {
      p_event_id: eventKey,
      p_coordinator_user_account_id: coordinatorKey,
    });

    if (error) {
      if (error.code === NOT_FOUND_OR_NOT_ASSIGNED) {
        throw new EventNotFoundError(event.id);
      }
      if (error.code === NOT_CONFIRMABLE) {
        // The status read before the call was Planning, or the domain would
        // have refused; DETAIL is what it is now, after the race was lost.
        throw new EventNotConfirmableError(error.details || event.status);
      }
      if (error.code === NOT_READY) {
        throw new EventNotReadyForConfirmationError(await this.blockingArrangements(event, confirmedBy));
      }
      throw new Error(`Failed to confirm event: ${error.message}`, { cause: error });
    }
  }

  /**
   * SPM-51: goes through `coordinator_complete_event`, which re-checks the
   * assignment, status and end under a row lock, writes the notes, and audits
   * the completion and the notes change in the same transaction.
   */
  async completeEvent(coordinatorId: UserAccountId, eventId: string, notes: string | null): Promise<void> {
    const eventKey = toKey(eventId);
    const coordinatorKey = toKey(coordinatorId);
    if (eventKey === null || coordinatorKey === null) {
      throw new CoordinatorEventNotFoundError(eventId);
    }

    const { error } = await this.client.rpc("coordinator_complete_event", {
      p_coordinator_user_account_id: coordinatorKey,
      p_event_id: eventKey,
      p_notes: notes,
    });

    if (error) {
      if (error.code === COMPLETE_EVENT_NOT_FOUND) {
        throw new CoordinatorEventNotFoundError(eventId);
      }
      if (error.code === COMPLETE_NOT_COMPLETABLE) {
        throw new EventNotCompletableError(error.details || "unknown");
      }
      if (error.code === COMPLETE_NOT_ENDED) {
        throw new EventNotYetEndedError();
      }
      throw new Error(`Failed to complete the event: ${error.message}`, { cause: error });
    }
  }

  /** Names what a losing race to `coordinator_confirm_event` was blocked by -- the SQLSTATE alone cannot carry the list. */
  private async blockingArrangements(
    event: CoordinatorEvent,
    confirmedBy: UserAccountId,
  ): Promise<readonly ArrangementType[]> {
    const facts = await new SupabaseEventReadinessRepository(this.client).factsFor(confirmedBy, event.id);
    return facts === null ? [] : blockingArrangements(assessReadiness(facts));
  }

  /**
   * Through `client_organisation_names`, not the table: RLS is enabled on
   * `client_organisation` with no policy, and this key has no table grant.
   */
  private async organisationNames(
    keys: readonly number[],
  ): Promise<ReadonlyMap<number, string>> {
    if (keys.length === 0) {
      return new Map();
    }

    const { data, error } = await this.client.rpc("client_organisation_names", {
      p_client_organisation_ids: [...new Set(keys)],
    });

    if (error) {
      throw new Error(`Failed to look up client organisation names: ${error.message}`, {
        cause: error,
      });
    }

    const rows = (data ?? []) as unknown as ClientOrganisationNameRow[];
    return new Map(rows.map((row) => [row.client_organisation_id, row.name]));
  }
}
