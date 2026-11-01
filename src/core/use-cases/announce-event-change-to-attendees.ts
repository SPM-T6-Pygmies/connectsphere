import type { EventId } from "../domain/event";
import type { TimeRangeOnDate } from "../domain/event-times";
import type { Notifier } from "../ports/outbound/notifier";
import type { RegistrationRepository } from "../ports/outbound/registration-repository";

/** SPM-69: what happened to the event, as far as its attendees are concerned. */
export type AttendeeEventChange =
  | { readonly kind: "rescheduled"; readonly times: readonly TimeRangeOnDate[]; readonly venueName: string | null }
  | { readonly kind: "cancelled" };

export interface AttendeeChangeAnnouncerDeps {
  readonly registrations: Pick<RegistrationRepository, "registeredFor">;
  readonly notifier: Pick<Notifier, "eventRescheduledForAttendee" | "eventCancelledForAttendee">;
}

export interface AttendeeAnnouncement {
  readonly sent: number;
  readonly failed: number;
}

/**
 * SPM-69: emails every Attendee holding a Registered registration that the
 * event was rescheduled or cancelled. Called once the change is stored.
 *
 * The one Release 1 trigger with an unbounded recipient set, so it sends one
 * at a time rather than all at once, and one that fails does not stop the rest
 * (#55: no delivery-time requirement, so no queue). The notifier logs a failure.
 */
export class AttendeeChangeAnnouncer {
  constructor(private readonly deps: AttendeeChangeAnnouncerDeps) {}

  async announce(eventId: EventId, eventName: string, change: AttendeeEventChange): Promise<AttendeeAnnouncement> {
    let sent = 0;
    let failed = 0;
    for (const registration of await this.deps.registrations.registeredFor(eventId)) {
      const notice = {
        registrationId: registration.id,
        recipientEmail: registration.attendeeEmail,
        attendeeName: registration.attendeeName,
        eventName,
      };
      try {
        if (change.kind === "rescheduled") {
          await this.deps.notifier.eventRescheduledForAttendee({
            ...notice,
            times: change.times,
            venueName: change.venueName,
          });
        } else {
          await this.deps.notifier.eventCancelledForAttendee(notice);
        }
        sent += 1;
      } catch {
        failed += 1;
      }
    }
    return { sent, failed };
  }
}
