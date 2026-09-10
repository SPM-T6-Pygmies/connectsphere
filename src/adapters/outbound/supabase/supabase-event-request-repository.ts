import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import type {
  EventRequest,
  EventRequestId,
  NewEventRequest,
} from "@/core/domain/event-request";
import type { EventRequestRepository } from "@/core/ports/outbound/event-request-repository";

import type { SupabaseServerClient } from "./client";
import { toDomain, toKey, toSubmitArgs, type EventRequestRow } from "./event-request-mapper";

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
    return row ? toDomain(row) : null;
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
   * Updating a stored request has no sanctioned path yet.
   *
   * The only caller is `ChangeEventOrganiserUseCase` (SPM-39), which no screen
   * resolves, and reassignment needs an authority model that #62 has not
   * settled -- so no function was written for it rather than one written on a
   * guess. SPM-39 adds it alongside the policy that decides who may call it.
   */
  async save(): Promise<void> {
    throw new Error(
      "Updating a stored event request needs its own database function; see SPM-39.",
    );
  }
}
