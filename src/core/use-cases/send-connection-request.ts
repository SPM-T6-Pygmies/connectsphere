import { blocksNewRequest, requestConnection, type ConnectionStatus } from "../domain/connection";
import { DuplicateConnectionError, MemberNotFoundError } from "../domain/errors";
import { memberId } from "../domain/member";
import type { Clock } from "../ports/outbound/clock";
import type { ConnectionRepository } from "../ports/outbound/connection-repository";
import type { MemberDirectory } from "../ports/outbound/member-directory";
import type { Notifier } from "../ports/outbound/notifier";

/**
 * The command this use case takes: the API of this application.
 *
 * Command and result are plain, serialisable data -- never domain objects.
 * That keeps every driving adapter (a Server Action, a route handler, a tRPC
 * procedure, a CLI, a test) able to speak to the core without importing
 * anything it needs to construct.
 */
export interface SendConnectionRequestCommand {
  readonly requesterId: string;
  readonly addresseeId: string;
}

export interface SendConnectionRequestResult {
  readonly connectionId: string;
  readonly status: ConnectionStatus;
}

export interface SendConnectionRequestDeps {
  readonly connections: ConnectionRepository;
  readonly members: MemberDirectory;
  readonly notifier: Notifier;
  readonly clock: Clock;
}

/**
 * Application layer: orchestration only.
 *
 * Read the body and notice there is no business rule in it. "You cannot
 * connect with yourself" lives in `requestConnection`; "a pending connection
 * blocks a new one" lives in `blocksNewRequest`. What is left here is the
 * sequence -- which ports to call, in what order, and what to do when one says
 * no. That split is what keeps use cases short as the domain grows.
 *
 * The dependencies arrive through the constructor, which is the entire
 * mechanism of dependency inversion: this class names four interfaces it owns,
 * and something outside it decides what satisfies them.
 */
export class SendConnectionRequestUseCase {
  constructor(private readonly deps: SendConnectionRequestDeps) {}

  async execute(command: SendConnectionRequestCommand): Promise<SendConnectionRequestResult> {
    const { connections, members, notifier, clock } = this.deps;

    const requesterId = memberId(command.requesterId);
    const addresseeId = memberId(command.addresseeId);

    // Constructing the domain object first means the self-connection invariant
    // rejects the command before a single byte crosses the network.
    const connection = requestConnection({
      id: connections.nextId(),
      requesterId,
      addresseeId,
      requestedAt: clock.now(),
    });

    if (!(await members.exists(addresseeId))) {
      throw new MemberNotFoundError(addresseeId);
    }

    const existing = await connections.findBetween(requesterId, addresseeId);
    if (existing && blocksNewRequest(existing)) {
      throw new DuplicateConnectionError(existing.status);
    }

    await connections.save(connection);
    await notifier.connectionRequested(connection);

    return { connectionId: connection.id, status: connection.status };
  }
}
