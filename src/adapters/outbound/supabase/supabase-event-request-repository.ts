import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import type {
  EventRequest,
  EventRequestId,
  NewEventRequest,
} from "@/core/domain/event-request";
import type { EventRequestRepository } from "@/core/ports/outbound/event-request-repository";

import type { SupabaseServerClient } from "./client";
import {
  toDeleteArgs,
  toDomain,
  toKey,
  toSaveArgs,
  toSubmitArgs,
  type EventRequestRow,
} from "./event-request-mapper";

/**
 * Event requests are reached through database functions, not through the table.
 *
 * `schema.sql` enables row level security on `event_request` and writes no
 * policy for it, and the key this client holds is publishable. So `anon` has
 * no grant on that table at all: these three functions are the whole surface,
 * and none of them can return a row the caller did not identify -- by
 * organisation, or by id. That matters because `event_request` carries
 * internal planning information brief s8b keeps away from external users.
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
}
