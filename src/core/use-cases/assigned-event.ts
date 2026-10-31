import type { CoordinatorEvent } from "../domain/coordinator-event";
import { CoordinatorEventNotFoundError } from "../domain/errors";
import type { UserAccountId } from "../domain/user-account";
import type {
  CoordinatorEventDetails,
  CoordinatorEventRepository,
} from "../ports/outbound/coordinator-event-repository";

/**
 * The event, if the caller is its assigned coordinator. Anyone else gets the
 * same answer as for an event that does not exist, so a guess cannot confirm
 * an event exists (#91).
 */
export async function assignedEvent(
  events: CoordinatorEventRepository,
  id: CoordinatorEvent["id"],
  caller: UserAccountId,
): Promise<CoordinatorEvent> {
  const event = await events.findAssignedById(caller, id);
  if (event === null) {
    throw new CoordinatorEventNotFoundError(id);
  }
  return event;
}

/** `assignedEvent`, for a use case that works from the event's details. */
export async function assignedEventDetails(
  events: CoordinatorEventRepository,
  id: string,
  caller: UserAccountId,
): Promise<CoordinatorEventDetails> {
  const event = await events.findAssigned(caller, id);
  if (event === null) {
    throw new CoordinatorEventNotFoundError(id);
  }
  return event;
}
