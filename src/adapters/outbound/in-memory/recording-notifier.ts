import type { Connection } from "@/core/domain/connection";
import type {
  ClarificationRequestedNotice,
  EquipmentDecidedNotice,
  EquipmentNeedsAttentionNotice,
  EventCancelledNotice,
  EventConfirmedNotice,
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

export class RecordingNotifier implements Notifier {
  readonly sent: Connection[] = [];
  readonly coordinatorAssignments: EventCoordinatorAssignedNotice[] = [];
  readonly organiserCoordinatorAssignments: OrganiserCoordinatorAssignedNotice[] = [];
  readonly clarificationRequests: ClarificationRequestedNotice[] = [];
  readonly organiserMessages: OrganiserMessagePostedNotice[] = [];
  readonly decisions: EventRequestDecidedNotice[] = [];
  readonly safetyChecksReady: SafetyCheckReadyNotice[] = [];
  readonly safetyChecksRecorded: SafetyCheckRecordedNotice[] = [];
  readonly bookingRequests: VenueBookingRequestedNotice[] = [];
  readonly equipmentNeedingAttention: EquipmentNeedsAttentionNotice[] = [];
  readonly equipmentDecisions: EquipmentDecidedNotice[] = [];
  readonly bookingsDecided: VenueBookingDecidedNotice[] = [];
  readonly holdsExpired: HoldExpiredNotice[] = [];
  readonly bookingsCancelled: VenueBookingCancelledNotice[] = [];
  readonly eventsConfirmed: EventConfirmedNotice[] = [];
  readonly eventsRescheduled: EventRescheduledNotice[] = [];
  readonly eventsCancelled: EventCancelledNotice[] = [];
  readonly bookingsFlagged: VenueBookingFlaggedNotice[] = [];
  readonly registrationsConfirmed: RegistrationConfirmedNotice[] = [];

  async connectionRequested(connection: Connection): Promise<void> {
    this.sent.push(connection);
  }

  async eventCoordinatorAssigned(notice: EventCoordinatorAssignedNotice): Promise<void> {
    this.coordinatorAssignments.push(notice);
  }

  async organiserCoordinatorAssigned(notice: OrganiserCoordinatorAssignedNotice): Promise<void> {
    this.organiserCoordinatorAssignments.push(notice);
  }

  async clarificationRequested(notice: ClarificationRequestedNotice): Promise<void> {
    this.clarificationRequests.push(notice);
  }

  async organiserMessagePosted(notice: OrganiserMessagePostedNotice): Promise<void> {
    this.organiserMessages.push(notice);
  }

  async eventRequestDecided(notice: EventRequestDecidedNotice): Promise<void> {
    this.decisions.push(notice);
  }

  async safetyCheckReady(notice: SafetyCheckReadyNotice): Promise<void> {
    this.safetyChecksReady.push(notice);
  }

  async safetyCheckRecorded(notice: SafetyCheckRecordedNotice): Promise<void> {
    this.safetyChecksRecorded.push(notice);
  }

  async venueBookingRequested(notice: VenueBookingRequestedNotice): Promise<void> {
    this.bookingRequests.push(notice);
  }

  async equipmentNeedsAttention(notice: EquipmentNeedsAttentionNotice): Promise<void> {
    this.equipmentNeedingAttention.push(notice);
  }

  async equipmentDecided(notice: EquipmentDecidedNotice): Promise<void> {
    this.equipmentDecisions.push(notice);
  }

  async venueBookingDecided(notice: VenueBookingDecidedNotice): Promise<void> {
    this.bookingsDecided.push(notice);
  }

  async holdExpired(notice: HoldExpiredNotice): Promise<void> {
    this.holdsExpired.push(notice);
  }

  async venueBookingCancelled(notice: VenueBookingCancelledNotice): Promise<void> {
    this.bookingsCancelled.push(notice);
  }

  async eventConfirmed(notice: EventConfirmedNotice): Promise<void> {
    this.eventsConfirmed.push(notice);
  }

  async eventRescheduled(notice: EventRescheduledNotice): Promise<void> {
    this.eventsRescheduled.push(notice);
  }

  async eventCancelled(notice: EventCancelledNotice): Promise<void> {
    this.eventsCancelled.push(notice);
  }

  async venueBookingFlagged(notice: VenueBookingFlaggedNotice): Promise<void> {
    this.bookingsFlagged.push(notice);
  }

  async registrationConfirmed(notice: RegistrationConfirmedNotice): Promise<void> {
    this.registrationsConfirmed.push(notice);
  }
}
