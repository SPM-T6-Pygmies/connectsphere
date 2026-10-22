import type { Novu } from "@novu/api";
import type { TriggerEventRequestDto, TriggerEventResponseDto } from "@novu/api/models/components";

import { LoggingNotifier } from "@/adapters/outbound/logging/logging-notifier";
import { CLARIFICATION_REQUESTED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/clarification-requested";
import { COORDINATOR_ASSIGNED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/coordinator-assigned";
import { EQUIPMENT_DECIDED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/equipment-decided";
import { EQUIPMENT_NEEDS_ATTENTION_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/equipment-needs-attention";
import { EVENT_CONFIRMED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/event-confirmed";
import { EVENT_REQUEST_DECIDED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/event-request-decided";
import { HOLD_EXPIRED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/hold-expired";
import { ORGANISER_COORDINATOR_ASSIGNED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/organiser-coordinator-assigned";
import { ORGANISER_MESSAGE_POSTED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/organiser-message-posted";
import { REGISTRATION_CONFIRMED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/registration-confirmed";
import { SAFETY_CHECK_READY_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/safety-check-ready";
import { SAFETY_CHECK_RECORDED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/safety-check-recorded";
import { VENUE_BOOKING_DECIDED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/venue-booking-decided";
import { VENUE_BOOKING_REQUESTED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/venue-booking-requested";
import type { Connection } from "@/core/domain/connection";
import type {
  ClarificationRequestedNotice,
  EquipmentDecidedNotice,
  EquipmentNeedsAttentionNotice,
  EventConfirmedNotice,
  EventCoordinatorAssignedNotice,
  EventRequestDecidedNotice,
  HoldExpiredNotice,
  Notifier,
  OrganiserCoordinatorAssignedNotice,
  OrganiserMessagePostedNotice,
  RegistrationConfirmedNotice,
  SafetyCheckReadyNotice,
  SafetyCheckRecordedNotice,
  VenueBookingDecidedNotice,
  VenueBookingRequestedNotice,
} from "@/core/ports/outbound/notifier";

/**
 * Why Novu did not take a trigger on, or `null` if it did.
 *
 * Novu answers some failures with a 201 rather than an error -- an inactive
 * workflow, a workflow with no active steps -- so a trigger that did not throw
 * has not necessarily been delivered.
 */
export function triggerFailure(
  result: Pick<TriggerEventResponseDto, "acknowledged" | "status" | "error">,
): string | null {
  if (result.acknowledged && result.status === "processed") return null;
  return [result.status, ...(result.error ?? [])].join(": ");
}

/**
 * Delivers notifications through Novu (SPM-173). The workflows themselves are
 * served from `/api/novu`; this only triggers them.
 *
 * Failures throw. Composition always wraps this in `SupabaseRecordingNotifier`,
 * which marks the row Failed and keeps a committed assignment from erroring.
 */
export class NovuNotifier implements Notifier {
  private readonly logging = new LoggingNotifier();

  constructor(
    private readonly novu: Novu,
    /** Local dev only: where `npx novu dev` tunnels the bridge. Cloud uses the synced URL. */
    private readonly bridgeUrl?: string,
    /** Local dev only: keeps each developer's subscribers apart (SPM-178). */
    private readonly subscriberPrefix = "",
    /** Where the app is served, for links in emails (SPM-87). */
    private readonly appBaseUrl = "http://localhost:3000",
  ) {}

  // No Novu workflow for connection requests yet.
  connectionRequested(connection: Connection): Promise<void> {
    return this.logging.connectionRequested(connection);
  }

  organiserCoordinatorAssigned(notice: OrganiserCoordinatorAssignedNotice): Promise<void> {
    return this.trigger(ORGANISER_COORDINATOR_ASSIGNED_WORKFLOW_ID, notice);
  }

  clarificationRequested(notice: ClarificationRequestedNotice): Promise<void> {
    return this.trigger(CLARIFICATION_REQUESTED_WORKFLOW_ID, notice);
  }

  organiserMessagePosted(notice: OrganiserMessagePostedNotice): Promise<void> {
    return this.trigger(ORGANISER_MESSAGE_POSTED_WORKFLOW_ID, notice);
  }

  eventRequestDecided(notice: EventRequestDecidedNotice): Promise<void> {
    return this.trigger(EVENT_REQUEST_DECIDED_WORKFLOW_ID, notice);
  }

  eventCoordinatorAssigned(notice: EventCoordinatorAssignedNotice): Promise<void> {
    return this.trigger(COORDINATOR_ASSIGNED_WORKFLOW_ID, notice);
  }

  safetyCheckReady(notice: SafetyCheckReadyNotice): Promise<void> {
    return this.trigger(SAFETY_CHECK_READY_WORKFLOW_ID, notice);
  }

  safetyCheckRecorded(notice: SafetyCheckRecordedNotice): Promise<void> {
    return this.trigger(SAFETY_CHECK_RECORDED_WORKFLOW_ID, notice);
  }

  venueBookingRequested(notice: VenueBookingRequestedNotice): Promise<void> {
    return this.trigger(VENUE_BOOKING_REQUESTED_WORKFLOW_ID, notice);
  }

  equipmentNeedsAttention(notice: EquipmentNeedsAttentionNotice): Promise<void> {
    return this.trigger(EQUIPMENT_NEEDS_ATTENTION_WORKFLOW_ID, notice);
  }

  equipmentDecided(notice: EquipmentDecidedNotice): Promise<void> {
    return this.trigger(EQUIPMENT_DECIDED_WORKFLOW_ID, notice);
  }

  venueBookingDecided(notice: VenueBookingDecidedNotice): Promise<void> {
    return this.trigger(VENUE_BOOKING_DECIDED_WORKFLOW_ID, notice);
  }

  holdExpired(notice: HoldExpiredNotice): Promise<void> {
    return this.trigger(HOLD_EXPIRED_WORKFLOW_ID, notice);
  }

  eventConfirmed(notice: EventConfirmedNotice): Promise<void> {
    return this.trigger(EVENT_CONFIRMED_WORKFLOW_ID, notice);
  }

  /**
   * An Attendee has no account, so Novu gets a subscriber per registration,
   * created on the fly from the email it is triggered with (SPM-305).
   */
  registrationConfirmed(notice: RegistrationConfirmedNotice): Promise<void> {
    return this.send(
      REGISTRATION_CONFIRMED_WORKFLOW_ID,
      {
        subscriberId: `${this.subscriberPrefix}registration-${notice.registrationId}`,
        email: notice.recipientEmail,
        firstName: notice.attendeeName,
      },
      { ...notice, registrationUrl: `${this.appBaseUrl}/registrations/${notice.registrationId}` },
    );
  }

  private trigger(
    workflowId: string,
    notice: { readonly recipientUserAccountId: string },
  ): Promise<void> {
    return this.send(workflowId, `${this.subscriberPrefix}${notice.recipientUserAccountId}`, {
      ...notice,
    });
  }

  private async send(
    workflowId: string,
    to: TriggerEventRequestDto["to"],
    payload: Record<string, unknown>,
  ): Promise<void> {
    let result: TriggerEventResponseDto;
    try {
      ({ result } = await this.novu.trigger({
        workflowId,
        to,
        payload,
        bridgeUrl: this.bridgeUrl,
      }));
    } catch (error) {
      // The SDK cannot parse some of Novu's own error responses (a 422 for an
      // unknown workflow surfaces as "Response validation failed"), so carry
      // the raw body -- it is what says `workflow_not_found`.
      const body = error instanceof Error && "body" in error ? String(error.body) : null;
      throw new Error(`Novu rejected ${workflowId}${body === null ? "" : `: ${body}`}`, {
        cause: error,
      });
    }
    const failure = triggerFailure(result);
    if (failure !== null) {
      throw new Error(`Novu did not process ${workflowId}: ${failure}`);
    }
  }
}
