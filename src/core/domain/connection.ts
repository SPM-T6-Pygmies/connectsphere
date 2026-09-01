import type { Brand } from "./brand";
import { InvalidConnectionIdError, SelfConnectionError } from "./errors";
import type { MemberId } from "./member";

export type ConnectionId = Brand<string, "ConnectionId">;

export type ConnectionStatus = "pending" | "accepted" | "declined";

export interface Connection {
  readonly id: ConnectionId;
  readonly requesterId: MemberId;
  readonly addresseeId: MemberId;
  readonly status: ConnectionStatus;
  readonly requestedAt: Date;
}

export function connectionId(raw: string): ConnectionId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidConnectionIdError(raw);
  }
  return trimmed as ConnectionId;
}

/**
 * The one place a pending `Connection` can come into existence.
 *
 * Because the invariant is enforced here rather than in the use case, a
 * `Connection` that violates it cannot be constructed at all -- not by a new
 * use case, not by an adapter reconstituting a bad database row, not by a test
 * fixture.
 */
export function requestConnection(params: {
  id: ConnectionId;
  requesterId: MemberId;
  addresseeId: MemberId;
  requestedAt: Date;
}): Connection {
  if (params.requesterId === params.addresseeId) {
    throw new SelfConnectionError();
  }

  return { ...params, status: "pending" };
}

/**
 * A business rule, not a database query.
 *
 * Whether an existing connection blocks a new request is a decision about the
 * product, so it lives in the domain as a pure predicate. The use case decides
 * *when* to ask; this decides the answer. Declined connections deliberately do
 * not block -- members are allowed to try again.
 */
export function blocksNewRequest(existing: Connection): boolean {
  return existing.status === "pending" || existing.status === "accepted";
}
