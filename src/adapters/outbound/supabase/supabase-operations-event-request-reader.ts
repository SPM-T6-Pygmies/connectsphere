import type { EventRequest, EventRequestId } from "@/core/domain/event-request";
import type { OperationsEventRequestReader } from "@/core/ports/outbound/operations-event-request-reader";

import type { SupabaseServerClient } from "./client";
import { toDomain, toKey, type EventRequestRow } from "./event-request-mapper";

/** Retrieves one event request through the Event Operations database surface. */
export class SupabaseOperationsEventRequestReader implements OperationsEventRequestReader {
  constructor(private readonly client: SupabaseServerClient) {}

  async findById(id: EventRequestId): Promise<EventRequest | null> {
    const key = toKey(id);
    if (key === null) {
      return null;
    }

    const { data, error } = await this.client.rpc("operations_event_request", {
      p_event_request_id: key,
    });

    if (error) {
      throw new Error(`Failed to look up Operations event request: ${error.message}`, {
        cause: error,
      });
    }

    const row = data as unknown as EventRequestRow | null;
    return row && row.event_request_id !== null ? toDomain(row) : null;
  }
}
