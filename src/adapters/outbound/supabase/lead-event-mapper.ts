import type { LeadEvent } from "@/core/domain/coordinator-workload";
import {
  EventCoordinatorNotFoundError,
  EventNotFoundError,
  EventNotReassignableError,
  NotCoordinatorLeadError,
  type DomainError,
} from "@/core/domain/errors";
import { eventRequestId } from "@/core/domain/event-request";
import type { LeadEventDetails } from "@/core/ports/outbound/lead-event-repository";

import { toCoordinatorEvent, type CoordinatorEventRecordRow } from "./coordinator-event-mapper";
import { toEventTimes, type EventSlotTimeRow } from "./event-mapper";

/** `lead_event` returns the full `event` row; the Lead also needs the request it came from. */
export interface LeadEventRow extends CoordinatorEventRecordRow {
  event_request_id: number | null;
  /** The `event_slots(event)` computed field, when the query selected it. */
  event_slots?: readonly EventSlotTimeRow[] | null;
}

/**
 * An event opened from its approved request. Every event is, so a row without
 * one is malformed -- refused here rather than reassigned without its notices.
 */
export function toLeadEvent(row: LeadEventRow): LeadEvent {
  if (row.event_request_id === null) {
    throw new Error(`Event ${row.event_id} has no event request.`);
  }
  return { ...toCoordinatorEvent(row), eventRequestId: eventRequestId(String(row.event_request_id)) };
}

/** The event with its start and end times, as the Lead opens it (SPM-326 AC1). */
export function toLeadEventDetails(row: LeadEventRow): LeadEventDetails {
  return { ...toLeadEvent(row), times: toEventTimes(row.event_slots ?? []) };
}

/** The domain error a Lead event function's custom SQLSTATE stands for, or null for any other failure. */
export function toLeadEventError(
  error: { readonly code?: string; readonly details?: string },
  context: { readonly eventId?: string; readonly coordinatorId?: string } = {},
): DomainError | null {
  switch (error.code) {
    case "CS060":
      return new NotCoordinatorLeadError();
    case "CS061":
      return new EventNotFoundError(context.eventId ?? "");
    case "CS062":
      return new EventNotReassignableError(error.details ?? "");
    case "CS063":
      return new EventCoordinatorNotFoundError(context.coordinatorId ?? "");
    default:
      return null;
  }
}
