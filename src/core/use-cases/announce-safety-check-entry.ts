import type { BookingId } from "../domain/booking";
import type { EventId } from "../domain/event";
import { confirmedVenues, entersSafetyCheck, type SafetyCheckCandidate } from "../domain/safety-check";
import type { Notifier } from "../ports/outbound/notifier";
import type { SafetyCheckWatch } from "../ports/outbound/safety-check-watch";

/** The event a change touches: by its own id, or by one of its bookings. */
export type SafetyCheckSubject = { readonly eventId: EventId } | { readonly bookingId: BookingId };

export interface SafetyCheckEntryAnnouncerDeps {
  readonly watch: SafetyCheckWatch;
  readonly notifier: Notifier;
}

/**
 * SPM-262: tells every Safety Officer when a change puts an event on their
 * Awaiting check list. Wraps the change rather than reading a status, because
 * "awaiting a check" is never stored -- `awaitsSafetyCheck` works it out from
 * the event's bookings and equipment each time.
 *
 * Every use case that can complete an event's arrangements runs its change
 * through `around`. One that is added later -- Technical Support reserving
 * equipment (SPM-18, SPM-108) -- must do the same, or its events join the
 * list unannounced.
 */
export class SafetyCheckEntryAnnouncer {
  constructor(private readonly deps: SafetyCheckEntryAnnouncerDeps) {}

  async around<T>(subject: SafetyCheckSubject, change: () => Promise<T>): Promise<T> {
    const before = await this.read(subject);
    const result = await change();
    const after = await this.read(subject);

    if (after !== null && entersSafetyCheck(before, after)) {
      await this.announce(after);
    }
    return result;
  }

  private read(subject: SafetyCheckSubject): Promise<SafetyCheckCandidate | null> {
    return "eventId" in subject
      ? this.deps.watch.candidateForEvent(subject.eventId)
      : this.deps.watch.candidateForBooking(subject.bookingId);
  }

  private async announce(candidate: SafetyCheckCandidate): Promise<void> {
    const { event } = candidate;
    const officers = await this.deps.watch.safetyOfficers();
    for (const officer of officers) {
      await this.deps.notifier.safetyCheckReady({
        recipientUserAccountId: officer,
        eventId: event.id,
        eventName: event.name,
        preferredDate: event.preferredDate,
        venues: confirmedVenues(candidate),
        equipmentLines: candidate.equipmentLines.length,
      });
    }
  }
}
