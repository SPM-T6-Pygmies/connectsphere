import type { ConnectionStatus } from "../../domain/connection";

/**
 * Driving port: the API of this application, phrased as a use case.
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

export interface SendConnectionRequest {
  execute(command: SendConnectionRequestCommand): Promise<SendConnectionRequestResult>;
}
