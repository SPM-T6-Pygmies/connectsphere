import type { Connection } from "@/core/domain/connection";
import type { Notifier } from "@/core/ports/outbound/notifier";

/**
 * Placeholder driven adapter until a real delivery channel exists.
 *
 * Worth noticing: shipping without notifications did not require the core to
 * know that notifications were unfinished. Replacing this with an email or
 * push adapter touches this file and one line of `src/composition`.
 */
export class LoggingNotifier implements Notifier {
  async connectionRequested(connection: Connection): Promise<void> {
    console.info(
      `[notifier] connection requested ${connection.requesterId} -> ${connection.addresseeId}`,
    );
  }
}
