import { compareByStart, isOpenForRegistration } from "../domain/event";
import type {
  ListEventsOpenForRegistration,
  ListEventsOpenForRegistrationResult,
} from "../ports/inbound/list-events-open-for-registration";
import type { Clock } from "../ports/outbound/clock";
import type { EventCatalogue } from "../ports/outbound/event-catalogue";
import { toAvailableEvent } from "./available-event";

export interface ListEventsOpenForRegistrationDeps {
  readonly events: EventCatalogue;
  readonly clock: Clock;
}

/**
 * SPM-79 from the reading side: an event an Attendee cannot register for is
 * not offered to them.
 *
 * The catalogue returns confirmed events; the domain decides which of those
 * are actually open. No condition is spelled out here -- the body is a fetch,
 * a filter by a named predicate, a sort and a map.
 */
export class ListEventsOpenForRegistrationUseCase implements ListEventsOpenForRegistration {
  constructor(private readonly deps: ListEventsOpenForRegistrationDeps) {}

  async execute(): Promise<ListEventsOpenForRegistrationResult> {
    const { events, clock } = this.deps;

    const now = clock.now();
    const open = (await events.listConfirmed())
      .filter((event) => isOpenForRegistration(event, now))
      .sort(compareByStart);

    return { events: open.map(toAvailableEvent) };
  }
}
