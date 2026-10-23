import { userAccountId } from "../domain/user-account";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";

export interface FindAssignedEventByRequestCommand {
  /** The approved request the event was opened from. */
  readonly eventRequestId: string;
  readonly userAccountId: string;
}

export interface FindAssignedEventByRequestDeps {
  readonly events: CoordinatorEventRepository;
}

/**
 * SPM-459: the id of the event opened from this request, so a link still keyed
 * by the request -- an old venue booking notification, the request's own page
 * -- can open the event's Venue tab.
 *
 * A thin read (ARCHITECTURE.md section 11): an event that is not the caller's
 * comes back the same as no event at all (#91).
 */
export class FindAssignedEventByRequestUseCase {
  constructor(private readonly deps: FindAssignedEventByRequestDeps) {}

  /** Null when no event assigned to the caller was opened from this request. */
  async execute(command: FindAssignedEventByRequestCommand): Promise<string | null> {
    const event = await this.deps.events.findAssignedByRequest(
      userAccountId(command.userAccountId),
      command.eventRequestId,
    );
    return event === null ? null : event.id;
  }
}
