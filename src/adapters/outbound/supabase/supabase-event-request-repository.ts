import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import type {
  EventRequest,
  EventRequestId,
  NewEventRequest,
} from "@/core/domain/event-request";
import type { EventRequestRepository } from "@/core/ports/outbound/event-request-repository";

import type { SupabaseServerClient } from "./client";
import {
  EVENT_REQUEST_COLUMNS,
  toDomain,
  toInsert,
  toKey,
  toUpdate,
  type EventRequestRow,
} from "./event-request-mapper";

/**
 * `event_request` in the team's schema (`supabase/schema.sql`).
 *
 * That the port is unchanged is the point -- the core asks for a place to keep
 * event requests and knows nothing about identity columns, PostgREST or the
 * fact that this store spells its columns in snake_case.
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

    const { data, error } = await this.client
      .from("event_request")
      .select(EVENT_REQUEST_COLUMNS)
      .eq("client_organisation_id", key)
      .order("created_at", { ascending: false })
      .returns<EventRequestRow[]>();

    if (error) {
      throw new Error(`Failed to list event requests: ${error.message}`, { cause: error });
    }

    return data.map(toDomain);
  }

  async findById(id: EventRequestId): Promise<EventRequest | null> {
    const key = toKey(id);
    if (key === null) {
      return null;
    }

    const { data, error } = await this.client
      .from("event_request")
      .select(EVENT_REQUEST_COLUMNS)
      .eq("event_request_id", key)
      .maybeSingle<EventRequestRow>();

    if (error) {
      throw new Error(`Failed to look up event request: ${error.message}`, { cause: error });
    }

    return data ? toDomain(data) : null;
  }

  /**
   * Inserts and reads the stored row straight back.
   *
   * The id comes from the identity column, and `created_at`/`updated_at` come
   * from their defaults, so the request the core gets back is the one the
   * database actually holds rather than the one we hoped it would.
   */
  async create(request: NewEventRequest): Promise<EventRequest> {
    const { data, error } = await this.client
      .from("event_request")
      .insert(toInsert(request))
      .select(EVENT_REQUEST_COLUMNS)
      .single<EventRequestRow>();

    if (error) {
      throw new Error(`Failed to submit event request: ${error.message}`, { cause: error });
    }

    return toDomain(data);
  }

  async save(request: EventRequest): Promise<void> {
    const { error } = await this.client.from("event_request").upsert(toUpdate(request));

    if (error) {
      throw new Error(`Failed to save event request: ${error.message}`, { cause: error });
    }
  }
}
