import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import {
  ClarificationMessageRequiredError,
  ClarificationThreadClosedError,
  ClarificationThreadNotResolvableError,
  DecisionReasonRequiredError,
  EventRequestNotDecidableError,
  EventRequestNotFoundError,
  EventRequestNotReturnableError,
} from "@/core/domain/errors";
import type { ClarificationMessageId } from "@/core/domain/clarification-message";
import type {
  EventRequest,
  EventRequestId,
  NewEventRequest,
} from "@/core/domain/event-request";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  EventRequestRepository,
  MyEventRequestSummary,
} from "@/core/ports/outbound/event-request-repository";

import type { SupabaseServerClient } from "./client";
import {
  toAssignEventCoordinatorArgs,
  toDecideArgs,
  toDeleteArgs,
  toDomain,
  toKey,
  toMyEventRequestSummary,
  toReassignArgs,
  toResolveClarificationThreadArgs,
  toReturnArgs,
  toSaveArgs,
  toSubmitArgs,
  type EventRequestRow,
} from "./event-request-mapper";

/** SQLSTATEs `coordinator_decide_event_request` comes back with. See its migration. */
const NOT_FOUND_OR_NOT_ASSIGNED = "CS010";
const NOT_DECIDABLE = "CS011";
const REASON_REQUIRED = "CS012";

/** SQLSTATEs the clarification functions come back with (SPM-33). See their migration. */
const NOT_RETURNABLE = "CS013";
const CLARIFICATION_MESSAGE_REQUIRED = "CS014";
const THREAD_NOT_RESOLVABLE = "CS017";
const THREAD_CLOSED = "CS018";

/**
 * Event requests are reached through database functions, not through the table.
 *
 * `schema.sql` enables row level security on `event_request` and writes no
 * policy for it, and the key this client holds is publishable. So `anon` has
 * no grant on that table at all: these functions are the whole surface, and
 * none of them can return a row the caller did not identify -- by
 * organisation, by coordinator, or by id. That matters because
 * `event_request` carries internal planning information brief s8b keeps away
 * from external users.
 *
 * That the port is unchanged is the point -- the core asks for somewhere to
 * keep event requests and knows nothing about how the store defends itself.
 * See supabase/migrations/20260909000000_organiser_event_request_submission.sql.
 */
export class SupabaseEventRequestRepository implements EventRequestRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async listAll(): Promise<readonly EventRequest[]> {
    const { data, error } = await this.client.rpc("operations_event_requests");

    if (error) {
      throw new Error(`Failed to list all event requests: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as EventRequestRow[];
    return rows.map(toDomain);
  }

  async listByClientOrganisation(
    clientOrganisationId: ClientOrganisationId,
  ): Promise<readonly EventRequest[]> {
    const key = toKey(clientOrganisationId);
    if (key === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("organiser_event_requests", {
      p_client_organisation_id: key,
    });

    if (error) {
      throw new Error(`Failed to list event requests: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as EventRequestRow[];
    return rows.map(toDomain);
  }

  async listRaisedBy(
    organiser: UserAccountId,
    organisation: ClientOrganisationId,
  ): Promise<readonly MyEventRequestSummary[]> {
    const organiserKey = toKey(organiser);
    const organisationKey = toKey(organisation);
    if (organiserKey === null || organisationKey === null) {
      return [];
    }

    // The same organisation-scoped function, narrowed to the caller's own rows
    // in the query itself. A filter on a function's result does not keep the
    // function's `order by`, so the order is restated.
    const { data, error } = await this.client
      .rpc("organiser_event_requests", { p_client_organisation_id: organisationKey })
      .eq("requesting_user_account_id", organiserKey)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list the organiser's event requests: ${error.message}`, {
        cause: error,
      });
    }

    const rows = (data ?? []) as unknown as EventRequestRow[];
    return rows.map(toMyEventRequestSummary);
  }

  async listByAssignedCoordinator(coordinatorId: UserAccountId): Promise<readonly EventRequest[]> {
    const key = toKey(coordinatorId);
    if (key === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("coordinator_event_requests", {
      p_coordinator_user_account_id: key,
    });

    if (error) {
      throw new Error(`Failed to list assigned event requests: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as EventRequestRow[];
    return rows.map(toDomain);
  }

  async findById(id: EventRequestId): Promise<EventRequest | null> {
    const key = toKey(id);
    if (key === null) {
      return null;
    }

    const { data, error } = await this.client.rpc("organiser_event_request", {
      p_event_request_id: key,
    });

    if (error) {
      throw new Error(`Failed to look up event request: ${error.message}`, { cause: error });
    }

    const row = data as unknown as EventRequestRow | null;
    // `organiser_event_request` is a `language sql` function returning a
    // single (non-`setof`) row: when its `select` matches nothing, Postgres
    // hands back one row of all-null fields rather than SQL `NULL`, so a miss
    // arrives here as a truthy object, not `null` -- checked on the primary
    // key, the one column no real row ever has null.
    return row && row.event_request_id !== null ? toDomain(row) : null;
  }

  /**
   * Inserts and reads the stored row straight back.
   *
   * The id comes from the identity column and the timestamps from their
   * defaults, so the request the core gets back is the one the database
   * actually holds rather than the one we hoped it would.
   */
  async create(request: NewEventRequest): Promise<EventRequest> {
    const { data, error } = await this.client.rpc(
      "organiser_submit_event_request",
      toSubmitArgs(request),
    );

    if (error) {
      throw new Error(`Failed to submit event request: ${error.message}`, { cause: error });
    }

    return toDomain(data as unknown as EventRequestRow);
  }

  /**
   * Writes an existing request's fields back -- SPM-38's save-a-draft-again
   * and finish-a-draft-by-submitting paths, both of which already know the
   * request's id and only need its contents to change, never who owns it or
   * which client organisation it belongs to.
   *
   * `organiser_save_event_request` only ever touches a row that is still
   * `Draft` and owned by the given organiser (the same edit rule
   * `eventRequestAccessFor` draws), so this cannot be used to rewrite a
   * request once it has moved on. Reassignment (SPM-39) changes who is
   * responsible for a request instead of what it says, which is a different
   * enough operation that it may still want its own function rather than
   * this one.
   */
  async save(request: EventRequest): Promise<void> {
    const args = toSaveArgs(request);
    if (args === null) {
      throw new Error(`Cannot save event request with malformed id "${request.id}".`);
    }

    const { error } = await this.client.rpc("organiser_save_event_request", args);

    if (error) {
      throw new Error(`Failed to save event request: ${error.message}`, { cause: error });
    }
  }

  /**
   * Removes a draft the Organiser no longer wants (SPM-38, not in the
   * original brief).
   *
   * Same guard as `save`: `organiser_discard_event_request_draft` only ever
   * touches a row that is still `Draft` and owned by the given organiser.
   */
  async delete(request: EventRequest): Promise<void> {
    const args = toDeleteArgs(request);
    if (args === null) {
      throw new Error(`Cannot discard event request with malformed id "${request.id}".`);
    }

    const { error } = await this.client.rpc("organiser_discard_event_request_draft", args);

    if (error) {
      throw new Error(`Failed to discard event request: ${error.message}`, { cause: error });
    }
  }

  /**
   * SPM-39 AC5: moves `requesting_user_account_id` to the incoming Organiser.
   *
   * Not `save()` -- `organiser_reassign_event_request` has no Draft or
   * current-owner guard, because a reassignment must be able to cross both.
   */
  async reassignResponsibleOrganiser(request: EventRequest): Promise<void> {
    const args = toReassignArgs(request);
    if (args === null) {
      throw new Error(`Cannot reassign event request with malformed id "${request.id}".`);
    }

    const { error } = await this.client.rpc("organiser_reassign_event_request", args);

    if (error) {
      throw new Error(`Failed to reassign event request: ${error.message}`, { cause: error });
    }
  }

  async assignEventCoordinator(request: EventRequest): Promise<void> {
    const args = toAssignEventCoordinatorArgs(request);
    if (args === null) {
      throw new Error(
        `Cannot assign a coordinator to event request with malformed ids "${request.id}" and "${request.assignedCoordinatorUserAccountId}".`,
      );
    }

    const { error } = await this.client.rpc("operations_assign_event_coordinator", args);

    if (error) {
      throw new Error(`Failed to assign Event Coordinator: ${error.message}`, { cause: error });
    }
  }

  async approveEventRequest(request: EventRequest, decidedBy: UserAccountId): Promise<void> {
    await this.decide(request, decidedBy);
  }

  async rejectEventRequest(request: EventRequest, decidedBy: UserAccountId): Promise<void> {
    await this.decide(request, decidedBy);
  }

  /**
   * SPM-34: both decisions go through `coordinator_decide_event_request`,
   * which re-checks the assignment, the status and the reason under a row
   * lock, and -- in the same transaction -- opens the event on approval and
   * writes the audit record. Its SQLSTATEs come back as the domain's own
   * errors, so losing a race to a concurrent decision reads exactly like
   * losing it a moment earlier, rather than a 500.
   */
  private async decide(request: EventRequest, decidedBy: UserAccountId): Promise<void> {
    const args = toDecideArgs(request, decidedBy);
    if (args === null) {
      throw new Error(
        `Cannot decide event request with malformed ids "${request.id}" and "${decidedBy}".`,
      );
    }

    const { error } = await this.client.rpc("coordinator_decide_event_request", args);

    if (error) {
      if (error.code === NOT_FOUND_OR_NOT_ASSIGNED) {
        throw new EventRequestNotFoundError(request.id);
      }
      if (error.code === NOT_DECIDABLE) {
        throw new EventRequestNotDecidableError();
      }
      if (error.code === REASON_REQUIRED) {
        throw new DecisionReasonRequiredError();
      }
      throw new Error(`Failed to decide event request: ${error.message}`, { cause: error });
    }
  }

  /**
   * SPM-33 AC1-AC3: `coordinator_return_event_request` moves the request to
   * `Returned`, opens the thread with the question and writes the audit row in
   * one transaction -- which is why the message comes down with the request
   * rather than through the thread repository. A return that moved the status
   * but lost its question would tell the Organiser nothing.
   *
   * Its SQLSTATEs come back as the domain's own errors, so losing a race to a
   * concurrent decision reads exactly like losing it a moment earlier.
   */
  async returnEventRequest(
    request: EventRequest,
    returnedBy: UserAccountId,
    message: string,
  ): Promise<void> {
    const args = toReturnArgs(request, returnedBy, message);
    if (args === null) {
      throw new Error(
        `Cannot return event request with malformed ids "${request.id}" and "${returnedBy}".`,
      );
    }

    const { error } = await this.client.rpc("coordinator_return_event_request", args);

    if (error) {
      if (error.code === NOT_FOUND_OR_NOT_ASSIGNED) {
        throw new EventRequestNotFoundError(request.id);
      }
      if (error.code === NOT_RETURNABLE) {
        throw new EventRequestNotReturnableError();
      }
      if (error.code === CLARIFICATION_MESSAGE_REQUIRED) {
        throw new ClarificationMessageRequiredError();
      }
      throw new Error(`Failed to return event request: ${error.message}`, { cause: error });
    }
  }

  /**
   * SPM-33 AC6: marks one question answered, and lets
   * `coordinator_resolve_clarification_thread` decide in the same transaction
   * whether that was the last one outstanding -- so the request's status and
   * its open questions cannot disagree, whoever else is resolving at the same
   * moment.
   */
  async resolveClarificationThread(
    request: EventRequest,
    resolvedBy: UserAccountId,
    messageId: ClarificationMessageId,
  ): Promise<void> {
    const args = toResolveClarificationThreadArgs(request, resolvedBy, messageId);
    if (args === null) {
      throw new Error(
        `Cannot resolve clarification "${messageId}" on event request with malformed ids "${request.id}" and "${resolvedBy}".`,
      );
    }

    const { error } = await this.client.rpc("coordinator_resolve_clarification_thread", args);

    if (error) {
      if (error.code === NOT_FOUND_OR_NOT_ASSIGNED) {
        throw new EventRequestNotFoundError(request.id);
      }
      if (error.code === THREAD_NOT_RESOLVABLE) {
        throw new ClarificationThreadNotResolvableError();
      }
      if (error.code === THREAD_CLOSED) {
        throw new ClarificationThreadClosedError();
      }
      throw new Error(`Failed to resolve the clarification: ${error.message}`, { cause: error });
    }
  }
}
