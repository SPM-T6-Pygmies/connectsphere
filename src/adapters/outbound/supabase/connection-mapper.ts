import {
  connectionId,
  type Connection,
  type ConnectionStatus,
} from "@/core/domain/connection";
import { memberId } from "@/core/domain/member";

/**
 * The database's shape, named honestly and kept in the adapter.
 *
 * snake_case columns and ISO date strings are Postgres's vocabulary. They stop
 * here. Nothing inward of this file has to know that `requestedAt` is spelled
 * `requested_at` in one particular store, which is precisely what makes
 * replacing that store a local change.
 */
export interface ConnectionRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  requested_at: string;
}

const STATUSES: readonly string[] = ["pending", "accepted", "declined"];

function toStatus(raw: string): ConnectionStatus {
  if (!STATUSES.includes(raw)) {
    // Data crossing inward is untrusted too, even from our own database.
    throw new Error(`Unknown connection status "${raw}" in the connections table.`);
  }
  return raw as ConnectionStatus;
}

export function toDomain(row: ConnectionRow): Connection {
  return {
    id: connectionId(row.id),
    requesterId: memberId(row.requester_id),
    addresseeId: memberId(row.addressee_id),
    status: toStatus(row.status),
    requestedAt: new Date(row.requested_at),
  };
}

export function toRow(connection: Connection): ConnectionRow {
  return {
    id: connection.id,
    requester_id: connection.requesterId,
    addressee_id: connection.addresseeId,
    status: connection.status,
    requested_at: connection.requestedAt.toISOString(),
  };
}
