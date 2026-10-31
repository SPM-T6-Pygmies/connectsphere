import type { SupabaseAdminClient } from "@/adapters/outbound/supabase/client";
import {
  changeRequestDecidedRow,
  changeRequestedRow,
  clarificationRequestedRow,
  coordinatorAssignedRow,
  equipmentDecidedRow,
  equipmentNeedsAttentionRow,
  eventCancelledRow,
  eventConfirmedRow,
  eventNoLongerConfirmedRow,
  eventRequestDecidedRow,
  eventRescheduledRow,
  holdExpiredRow,
  organiserCoordinatorAssignedRow,
  organiserMessagePostedRow,
  safetyCheckReadyRow,
  safetyCheckRecordedRow,
  venueBookingCancelledRow,
  venueBookingFlaggedRow,
  venueBookingDecidedRow,
  venueBookingRequestedRow,
  type NotificationRow,
} from "@/adapters/outbound/supabase/notification-row";
import type { Connection } from "@/core/domain/connection";
import type {
  AttendeeEventChangedNotice,
  ChangeRequestDecidedNotice,
  ChangeRequestedNotice,
  ClarificationRequestedNotice,
  EquipmentDecidedNotice,
  EquipmentNeedsAttentionNotice,
  EventCancelledNotice,
  EventConfirmedNotice,
  EventNoLongerConfirmedNotice,
  EventRescheduledForAttendeeNotice,
  EventCoordinatorAssignedNotice,
  EventRequestDecidedNotice,
  EventRescheduledNotice,
  HoldExpiredNotice,
  Notifier,
  OrganiserCoordinatorAssignedNotice,
  OrganiserMessagePostedNotice,
  RegistrationConfirmedNotice,
  SafetyCheckReadyNotice,
  SafetyCheckRecordedNotice,
  VenueBookingCancelledNotice,
  VenueBookingFlaggedNotice,
  VenueBookingDecidedNotice,
  VenueBookingRequestedNotice,
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

  organiserCoordinatorAssigned(notice: OrganiserCoordinatorAssignedNotice): Promise<void> {
    return this.recordAndDeliver(organiserCoordinatorAssignedRow(notice), () =>
      this.inner.organiserCoordinatorAssigned(notice),
    );
  }

  clarificationRequested(notice: ClarificationRequestedNotice): Promise<void> {
    return this.recordAndDeliver(clarificationRequestedRow(notice), () =>
      this.inner.clarificationRequested(notice),
    );
  }

  organiserMessagePosted(notice: OrganiserMessagePostedNotice): Promise<void> {
    return this.recordAndDeliver(organiserMessagePostedRow(notice), () =>
      this.inner.organiserMessagePosted(notice),
    );
  }

  eventRequestDecided(notice: EventRequestDecidedNotice): Promise<void> {
    return this.recordAndDeliver(eventRequestDecidedRow(notice), () =>
      this.inner.eventRequestDecided(notice),
    );
  }

  eventCoordinatorAssigned(notice: EventCoordinatorAssignedNotice): Promise<void> {
    return this.recordAndDeliver(coordinatorAssignedRow(notice), () =>
      this.inner.eventCoordinatorAssigned(notice),
    );
  }

  safetyCheckReady(notice: SafetyCheckReadyNotice): Promise<void> {
    return this.recordAndDeliver(safetyCheckReadyRow(notice), () => this.inner.safetyCheckReady(notice));
  }

  safetyCheckRecorded(notice: SafetyCheckRecordedNotice): Promise<void> {
    return this.recordAndDeliver(safetyCheckRecordedRow(notice), () => this.inner.safetyCheckRecorded(notice));
  }

  venueBookingRequested(notice: VenueBookingRequestedNotice): Promise<void> {
    return this.recordAndDeliver(venueBookingRequestedRow(notice), () =>
      this.inner.venueBookingRequested(notice),
    );
  }

  equipmentNeedsAttention(notice: EquipmentNeedsAttentionNotice): Promise<void> {
    return this.recordAndDeliver(equipmentNeedsAttentionRow(notice), () =>
      this.inner.equipmentNeedsAttention(notice),
    );
  }

  equipmentDecided(notice: EquipmentDecidedNotice): Promise<void> {
    return this.recordAndDeliver(equipmentDecidedRow(notice), () => this.inner.equipmentDecided(notice));
  }

  venueBookingDecided(notice: VenueBookingDecidedNotice): Promise<void> {
    return this.recordAndDeliver(venueBookingDecidedRow(notice), () =>
      this.inner.venueBookingDecided(notice),
    );
  }

  holdExpired(notice: HoldExpiredNotice): Promise<void> {
    return this.recordAndDeliver(holdExpiredRow(notice), () => this.inner.holdExpired(notice));
  }

  venueBookingCancelled(notice: VenueBookingCancelledNotice): Promise<void> {
    return this.recordAndDeliver(venueBookingCancelledRow(notice), () =>
      this.inner.venueBookingCancelled(notice),
    );
  }

  eventConfirmed(notice: EventConfirmedNotice): Promise<void> {
    return this.recordAndDeliver(eventConfirmedRow(notice), () => this.inner.eventConfirmed(notice));
  }

  eventRescheduled(notice: EventRescheduledNotice): Promise<void> {
    return this.recordAndDeliver(eventRescheduledRow(notice), () => this.inner.eventRescheduled(notice));
  }

  eventCancelled(notice: EventCancelledNotice): Promise<void> {
    return this.recordAndDeliver(eventCancelledRow(notice), () => this.inner.eventCancelled(notice));
  }

  venueBookingFlagged(notice: VenueBookingFlaggedNotice): Promise<void> {
    return this.recordAndDeliver(venueBookingFlaggedRow(notice), () => this.inner.venueBookingFlagged(notice));
  }

  changeRequested(notice: ChangeRequestedNotice): Promise<void> {
    return this.recordAndDeliver(changeRequestedRow(notice), () => this.inner.changeRequested(notice));
  }

  changeRequestDecided(notice: ChangeRequestDecidedNotice): Promise<void> {
    return this.recordAndDeliver(changeRequestDecidedRow(notice), () => this.inner.changeRequestDecided(notice));
  }

  eventNoLongerConfirmed(notice: EventNoLongerConfirmedNotice): Promise<void> {
    return this.recordAndDeliver(eventNoLongerConfirmedRow(notice), () => this.inner.eventNoLongerConfirmed(notice));
  }

  /**
   * Delivered but not recorded: a `notification` row needs a recipient user
   * account, and an Attendee has none (SPM-87). Still never throws -- the
   * registration it confirms is already saved.
   */
  async registrationConfirmed(notice: RegistrationConfirmedNotice): Promise<void> {
    await this.deliverUnrecorded(() => this.inner.registrationConfirmed(notice));
  }

  /** SPM-69: an Attendee has no account either, so delivered but not recorded. */
  async eventRescheduledForAttendee(notice: EventRescheduledForAttendeeNotice): Promise<void> {
    await this.deliverUnrecorded(() => this.inner.eventRescheduledForAttendee(notice));
  }

  async eventCancelledForAttendee(notice: AttendeeEventChangedNotice): Promise<void> {
    await this.deliverUnrecorded(() => this.inner.eventCancelledForAttendee(notice));
  }

  private async deliverUnrecorded(deliver: () => Promise<void>): Promise<void> {
    try {
      await deliver();
    } catch (error) {
      console.error("[SupabaseRecordingNotifier] Delivery failed:", error);
    }
  }

  /** Record the row Pending, deliver, then mark it Sent or Failed. */
  private async recordAndDeliver(
    row: NotificationRow,
    deliver: () => Promise<void>,
  ): Promise<void> {
    const notificationId = await this.record(row);
    try {
      await deliver();
    } catch (error) {
      console.error("[SupabaseRecordingNotifier] Delivery failed:", error);
      await this.mark(notificationId, { status: "Failed" });
      return;
    }
    await this.mark(notificationId, { status: "Sent", sent_at: new Date().toISOString() });
  }

  private async record(row: NotificationRow): Promise<number | null> {
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
