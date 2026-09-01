import type { Connection, ConnectionId } from "../../domain/connection";
import type { MemberId } from "../../domain/member";

/**
 * Driven port: connection persistence.
 *
 * Note what is absent. No `select`, no `where`, no pagination, no row type --
 * the port is phrased in the language of the business ("is there a connection
 * between these two members?"), not the language of the store. That is the
 * difference between a port and a leaked ORM.
 */
export interface ConnectionRepository {
  /**
   * Identity is the store's responsibility, but it is needed *before* the row
   * exists so the domain object can be whole from birth.
   */
  nextId(): ConnectionId;

  /** Order-independent: a connection between A and B is the same as B and A. */
  findBetween(a: MemberId, b: MemberId): Promise<Connection | null>;

  save(connection: Connection): Promise<void>;
}
