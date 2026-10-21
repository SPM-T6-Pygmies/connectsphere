import type { CoordinatorEventStatus } from "./coordinator-event";
import { EventNotCancellableError } from "./errors";

/** SPM-55 AC2: "any stage" means any stage before the event is over. */
const CANCELLABLE: readonly CoordinatorEventStatus[] = ["Planning", "Blocked", "Confirmed"];

/** Whether the event may be cancelled -- so a screen does not decide it from the status itself. */
export function canCancel(event: { readonly status: CoordinatorEventStatus }): boolean {
  return CANCELLABLE.includes(event.status);
}

/**
 * SPM-55: the assigned coordinator cancels a Planning, Blocked or Confirmed
 * event; a Completed one is over and a Cancelled one already is (AC2).
 *
 * `coordinator_cancel_event` restates this under its row lock (§8.6) and, in
 * the same transaction, gives back everything the event holds at a venue
 * (AC3, AC4) -- change both together.
 */
export function cancelEvent(event: { readonly status: CoordinatorEventStatus }): "Cancelled" {
  if (!canCancel(event)) {
    throw new EventNotCancellableError(event.status);
  }
  return "Cancelled";
}
