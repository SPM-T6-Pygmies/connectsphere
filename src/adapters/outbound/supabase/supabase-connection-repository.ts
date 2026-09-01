import type { Connection, ConnectionId } from "@/core/domain/connection";
import { connectionId } from "@/core/domain/connection";
import type { MemberId } from "@/core/domain/member";
import type { ConnectionRepository } from "@/core/ports/outbound/connection-repository";

import type { SupabaseServerClient } from "./client";
import { toDomain, toRow, type ConnectionRow } from "./connection-mapper";

export class SupabaseConnectionRepository implements ConnectionRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  nextId(): ConnectionId {
    return connectionId(crypto.randomUUID());
  }

  async findBetween(a: MemberId, b: MemberId): Promise<Connection | null> {
    // Matching both columns against both ids covers (a,b) and (b,a) without
    // building a filter string, and the self-connection invariant plus the
    // table's CHECK constraint rule out the (a,a) case.
    const { data, error } = await this.client
      .from("connections")
      .select("id, requester_id, addressee_id, status, requested_at")
      .in("requester_id", [a, b])
      .in("addressee_id", [a, b])
      .limit(1)
      .maybeSingle<ConnectionRow>();

    if (error) {
      throw new Error(`Failed to look up connection: ${error.message}`, { cause: error });
    }

    return data ? toDomain(data) : null;
  }

  async save(connection: Connection): Promise<void> {
    const { error } = await this.client.from("connections").upsert(toRow(connection));

    if (error) {
      throw new Error(`Failed to save connection: ${error.message}`, { cause: error });
    }
  }
}
