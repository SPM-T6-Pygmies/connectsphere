import type { BookingStatus } from "./booking";
import type { CoordinatorEventStatus } from "./coordinator-event";
import type { EquipmentRequirement } from "./equipment-requirement";
import type { EventId } from "./event";

/** One of an event's venue bookings, on the event itself or on one of its sessions. */
export interface SafetyCheckBooking {
  readonly status: BookingStatus;
  readonly venueName: string;
}

export type SafetyCheckEquipmentLine = Pick<
  EquipmentRequirement,
  "state" | "quantityRequested" | "quantityReserved"
>;

/** What the store knows about an event, before any judgement about whether it awaits a safety check. */
export interface SafetyCheckCandidate {
  readonly event: {
    readonly id: EventId;
    readonly name: string;
    readonly status: CoordinatorEventStatus;
    /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
    readonly preferredDate: string | null;
    readonly expectedAttendance: number | null;
  };
  readonly bookings: readonly SafetyCheckBooking[];
  readonly equipmentLines: readonly SafetyCheckEquipmentLine[];
}

/** A booking still in play. A rejected, released or cancelled one says nothing about the venue any more. */
function isLive(booking: SafetyCheckBooking): boolean {
  return booking.status === "Requested" || booking.status === "Tentative Hold" || booking.status === "Confirmed";
}

/** Reserved, and for at least as many as the line asks for -- a partial reservation is not confirmed. */
function isReservedInFull(line: SafetyCheckEquipmentLine): boolean {
  return line.state === "Reserved" && line.quantityReserved >= line.quantityRequested;
}

/**
 * SPM-259: whether an event is waiting for the Safety Officer. It is when it
 * is still Planning (AC4), has at least one live venue booking and every live
 * one is Confirmed, and every equipment line is reserved in full (AC1, AC3).
 * No equipment lines means nothing to reserve, so the venue alone decides (AC2).
 *
 * Whether a check has already been recorded is SPM-260's to add.
 */
export function awaitsSafetyCheck(candidate: SafetyCheckCandidate): boolean {
  const live = candidate.bookings.filter(isLive);
  return (
    candidate.event.status === "Planning" &&
    live.length > 0 &&
    live.every((booking) => booking.status === "Confirmed") &&
    candidate.equipmentLines.every(isReservedInFull)
  );
}

/** AC5: each venue the event is confirmed at, once, alphabetically. */
export function confirmedVenues(candidate: SafetyCheckCandidate): string[] {
  const names = candidate.bookings
    .filter((booking) => booking.status === "Confirmed")
    .map((booking) => booking.venueName);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}
