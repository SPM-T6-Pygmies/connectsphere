import { connectionId, type Connection, type ConnectionId } from "@/core/domain/connection";
import type { MemberId } from "@/core/domain/member";
import type { ConnectionRepository } from "@/core/ports/outbound/connection-repository";

/**
 * A real implementation of the port that happens to store rows in a Map.
 *
 * This is not a mock. Nothing here is stubbed per-test and no call
 * expectations are asserted -- it obeys the same contract the Supabase adapter
 * obeys, which is why a test written against it stays true when the real
 * adapter is swapped in.
 */
export class InMemoryConnectionRepository implements ConnectionRepository {
  private readonly rows = new Map<ConnectionId, Connection>();
  private sequence = 0;

  constructor(seed: readonly Connection[] = []) {
    for (const connection of seed) {
      this.rows.set(connection.id, connection);
    }
  }

  nextId(): ConnectionId {
    this.sequence += 1;
    return connectionId(`connection-${this.sequence}`);
  }

  async findBetween(a: MemberId, b: MemberId): Promise<Connection | null> {
    for (const row of this.rows.values()) {
      const matches =
        (row.requesterId === a && row.addresseeId === b) ||
        (row.requesterId === b && row.addresseeId === a);
      if (matches) {
        return row;
      }
    }
    return null;
  }

  async save(connection: Connection): Promise<void> {
    this.rows.set(connection.id, connection);
  }

  /** Test affordance, not part of the port. */
  all(): Connection[] {
    return [...this.rows.values()];
  }
}
