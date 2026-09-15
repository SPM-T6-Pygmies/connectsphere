import { userAccountId } from "../domain/user-account";
import type {
  AssignedEventSummary,
  CoordinatorEventRepository,
} from "../ports/outbound/coordinator-event-repository";

export type { AssignedEventSummary } from "../ports/outbound/coordinator-event-repository";

export interface ViewAssignedEventsCommand {
  readonly userAccountId: string;
}

export interface ViewAssignedEventsResult {
  readonly events: readonly AssignedEventSummary[];
}

export interface ViewAssignedEventsDeps {
  readonly events: CoordinatorEventRepository;
}

/**
 * SPM-121's own scoping note: "My events" is every event the caller is
 * coordinating, whatever its status -- unlike "My requests", nothing here is
 * excluded, because a decided/completed/cancelled event doesn't move to a
 * separate archive the way a decided request does.
 *
 * A thin read slice (ARCHITECTURE.md section 11): no domain rule decides
 * anything about this list, so the store answers with the view itself.
 */
export class ViewAssignedEventsUseCase {
  constructor(private readonly deps: ViewAssignedEventsDeps) {}

  async execute(command: ViewAssignedEventsCommand): Promise<ViewAssignedEventsResult> {
    return {
      events: await this.deps.events.listByAssignedCoordinator(
        userAccountId(command.userAccountId),
      ),
    };
  }
}
