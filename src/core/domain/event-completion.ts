import { slotEndsAt, type SlotOnDate } from "./booking";
import type { CoordinatorEventStatus } from "./coordinator-event";
import { EventNotCompletableError, EventNotYetEndedError } from "./errors";

/** What completing an event depends on: where it stands, when it runs, and the notes it already has. */
export interface CompletableEvent {
  readonly status: CoordinatorEventStatus;
  readonly slots: readonly SlotOnDate[];
  readonly operationalNotes: string | null;
}

/** What `completeEvent` agreed to. */
export interface EventCompletion {
  readonly status: "Completed";
  /** The operational notes to store, or null to keep the ones already there. */
  readonly operationalNotes: string | null;
}

/**
 * When the event is over: the end of its latest slot. Null when it has no
 * slots -- the event's own start/end times were dropped for slots
 * (20261006070000_drop_timestamp_timing.sql), so there is nothing else to go by.
 */
export function eventEndsAt(event: Pick<CompletableEvent, "slots">): Date | null {
  let latest: Date | null = null;
  for (const slot of event.slots) {
    const endsAt = slotEndsAt(slot);
    if (latest === null || endsAt > latest) {
      latest = endsAt;
    }
  }
  return latest;
}

function hasEnded(event: CompletableEvent, now: Date): boolean {
  const endsAt = eventEndsAt(event);
  return endsAt !== null && now >= endsAt;
}

/** Whether the event may be marked completed right now -- so a screen does not decide it from the status itself. */
export function canComplete(event: CompletableEvent, now: Date): boolean {
  return event.status === "Confirmed" && hasEnded(event, now);
}

/**
 * SPM-51: the assigned coordinator marks a Confirmed event Completed once it
 * has ended, optionally recording operational notes.
 *
 * Notes are trimmed; blank notes, or notes the event already has, leave the
 * stored ones as they are. `coordinator_complete_event` restates the status
 * and end checks in SQL under its row lock (§8.6) -- change both together.
 */
export function completeEvent(event: CompletableEvent, now: Date, notes: string = ""): EventCompletion {
  if (event.status !== "Confirmed") {
    throw new EventNotCompletableError(event.status);
  }
  if (!hasEnded(event, now)) {
    throw new EventNotYetEndedError();
  }

  const trimmed = notes.trim();
  const changed = trimmed.length > 0 && trimmed !== (event.operationalNotes?.trim() ?? "");
  return { status: "Completed", operationalNotes: changed ? trimmed : null };
}
