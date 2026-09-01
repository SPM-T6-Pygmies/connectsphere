import type { Connection } from "@/core/domain/connection";
import type { Notifier } from "@/core/ports/outbound/notifier";

export class RecordingNotifier implements Notifier {
  readonly sent: Connection[] = [];

  async connectionRequested(connection: Connection): Promise<void> {
    this.sent.push(connection);
  }
}
