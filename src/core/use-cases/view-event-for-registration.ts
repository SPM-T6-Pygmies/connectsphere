import { eventId, isOpenForRegistration } from "../domain/event";
import { EventNotFoundError, EventNotOpenForRegistrationError } from "../domain/errors";
import type { Clock } from "../ports/outbound/clock";
import type { EventCatalogue } from "../ports/outbound/event-catalogue";
import { toAvailableEvent, type AvailableEvent } from "./available-event";

export interface ViewEventForRegistrationCommand {
  readonly eventId: string;
}

export interface ViewEventForRegistrationResult {
  readonly event: AvailableEvent;
}

export interface ViewEventForRegistrationDeps {
  readonly events: EventCatalogue;
  readonly clock: Clock;
}

/**
 * SPM-79 for a directly addressed event.
 *
 * Omitting an event from the list is not enough: guessing or keeping its URL
 * must not reach a registration form either. This is where that refusal lives,
 * which is why it is a use case and not two lines in a page component.
 */
export class ViewEventForRegistrationUseCase {
  constructor(private readonly deps: ViewEventForRegistrationDeps) {}

  async execute(command: ViewEventForRegistrationCommand): Promise<ViewEventForRegistrationResult> {
    const { events, clock } = this.deps;

    const id = eventId(command.eventId);
    const event = await events.findEvent(id);
    if (event === null) {
      throw new EventNotFoundError(id);
    }

    if (!isOpenForRegistration(event, clock.now())) {
      throw new EventNotOpenForRegistrationError(event.name);
    }

    return { event: toAvailableEvent(event) };
  }
}
