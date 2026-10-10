import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import {
  EventNotAwaitingSafetyCheckError,
  EventNotFoundError,
  NotSafetyOfficerError,
  SafetyCheckCommentsRequiredError,
  SafetyCheckNotResubmittableError,
  type DomainError,
} from "@/core/domain/errors";
import type { SafetyCheckOutcome } from "@/core/domain/safety-check";
import type {
  CoordinatorSafetyCheckHistory,
  SafetyCheckEntry,
  SafetyCheckReview,
} from "@/core/ports/outbound/safety-check-repository";

import { toSafetyCheckCandidate, type SafetyCheckCandidateRow } from "./safety-check-candidate-mapper";

/** One recorded check, as the safety check functions return it. */
export interface SafetyCheckEntryRow {
  outcome: SafetyCheckOutcome;
  comments: string | null;
  checked_by_name: string;
  checked_at: string;
  resubmitted_at: string | null;
}

/** What `coordinator_event_safety_checks` returns for the coordinator's own event (SPM-261). */
export interface CoordinatorSafetyCheckHistoryRow {
  event_status: CoordinatorEventStatus;
  checks: SafetyCheckEntryRow[];
}

function toSafetyCheckEntry(check: SafetyCheckEntryRow): SafetyCheckEntry {
  return {
    outcome: check.outcome,
    comments: check.comments,
    checkedByName: check.checked_by_name,
    checkedAt: new Date(check.checked_at).toISOString(),
    resubmittedAt: check.resubmitted_at === null ? null : new Date(check.resubmitted_at).toISOString(),
  };
}

/** What `safety_officer_safety_check_review` returns for an event that exists. */
export interface SafetyCheckReviewRow extends SafetyCheckCandidateRow {
  accessibility_requirements: string | null;
  coordinator_user_account_id: number | null;
  venues: {
    venue_location: string;
    room_layout_name: string | null;
    layout_capacity: number | null;
    accessibility: string | null;
  }[];
  equipment: { item: string; quantity_requested: number; quantity_reserved: number }[];
  checks: SafetyCheckEntryRow[];
}

export function toSafetyCheckReview(row: SafetyCheckReviewRow): SafetyCheckReview {
  return {
    candidate: toSafetyCheckCandidate(row),
    accessibilityRequirements: row.accessibility_requirements,
    coordinatorUserAccountId:
      row.coordinator_user_account_id === null ? null : String(row.coordinator_user_account_id),
    venues: row.venues.map((venue) => ({
      venueName: venue.venue_location,
      layoutName: venue.room_layout_name,
      layoutCapacity: venue.layout_capacity,
      accessibility: venue.accessibility,
    })),
    equipment: row.equipment.map((line) => ({
      item: line.item,
      quantityRequested: line.quantity_requested,
      quantityReserved: line.quantity_reserved,
    })),
    checks: row.checks.map(toSafetyCheckEntry),
  };
}

export function toCoordinatorSafetyCheckHistory(row: CoordinatorSafetyCheckHistoryRow): CoordinatorSafetyCheckHistory {
  return { eventStatus: row.event_status, checks: row.checks.map(toSafetyCheckEntry) };
}

/**
 * The domain error a safety check function's SQLSTATE stands for -- see
 * 20261010010000 and 20261013163600 -- or null for anything else, which the caller reports as
 * the unexpected failure it is.
 */
export function toSafetyCheckError(error: { readonly code?: string }, eventId = ""): DomainError | null {
  switch (error.code) {
    case "CS050":
      return new NotSafetyOfficerError();
    case "CS051":
      return new EventNotAwaitingSafetyCheckError();
    case "CS052":
      return new SafetyCheckCommentsRequiredError();
    case "CS053":
      return new EventNotFoundError(eventId);
    case "CS054":
      return new SafetyCheckNotResubmittableError();
    default:
      return null;
  }
}
