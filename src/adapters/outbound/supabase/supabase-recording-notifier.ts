import type { SupabaseAdminClient } from "@/adapters/outbound/supabase/client";
import { coordinatorAssignedRow } from "@/adapters/outbound/supabase/notification-row";
import type { Connection } from "@/core/domain/connection";
import type {
  EventCoordinatorAssignedNotice,
  Notifier,
} from "@/core/ports/outbound/notifier";

/**
 * Keeps our own copy of every notification in the `notification` table (SPM-177),
 * whichever `Notifier` actually delivers it.
 *
 * A decorator rather than a second port: the core still only knows "tell
 * someone", and composition decides both who delivers and that it is recorded.
 *
 * Nothing here throws. By the time a notifier runs, the change it announces is
 * already committed, so a failed delivery or a failed record is logged -- and
 * the row marked Failed where there is one -- rather than turned into an error
 * for a user whose action succeeded.
 */
export class SupabaseRecordingNotifier implements Notifier {
  constructor(
    private readonly supabase: SupabaseAdminClient,
    private readonly inner: Notifier,
  ) {}

  connectionRequested(connection: Connection): Promise<void> {
    return this.inner.connectionRequested(connection);
  }

  async eventCoordinatorAssigned(notice: EventCoordinatorAssignedNotice): Promise<void> {
    const notificationId = await this.record(coordinatorAssignedRow(notice));
    try {
      await this.inner.eventCoordinatorAssigned(notice);
    } catch (error) {
      console.error("[SupabaseRecordingNotifier] Delivery failed:", error);
      await this.mark(notificationId, { status: "Failed" });
      return;
    }
    await this.mark(notificationId, { status: "Sent", sent_at: new Date().toISOString() });
  }

  private async record(row: ReturnType<typeof coordinatorAssignedRow>): Promise<number | null> {
    const { data, error } = await this.supabase
      .from("notification")
      .insert(row)
      .select("notification_id")
      .single();
    if (error) {
      console.error("[SupabaseRecordingNotifier] Failed to record notification:", error.message);
      return null;
    }
    return data.notification_id;
  }

  private async mark(
    notificationId: number | null,
    outcome: { status: "Sent"; sent_at: string } | { status: "Failed" },
  ): Promise<void> {
    if (notificationId === null) return;
    const { error } = await this.supabase
      .from("notification")
      .update(outcome)
      .eq("notification_id", notificationId);
    if (error) {
      console.error("[SupabaseRecordingNotifier] Failed to update notification:", error.message);
    }
  }
}
