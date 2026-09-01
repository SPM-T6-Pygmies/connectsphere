import type { Connection } from "../../domain/connection";

/**
 * Driven port: telling someone something happened.
 *
 * The core does not know whether this becomes an email, a push notification, a
 * row in an outbox table or a no-op in development. Swapping any of those in
 * is a change to one file in `src/adapters/outbound`.
 */
export interface Notifier {
  connectionRequested(connection: Connection): Promise<void>;
}
