import { eventId } from "../domain/event";
import { canResubmitForSafetyCheck } from "../domain/safety-check";
import { userAccountId } from "../domain/user-account";
import type { SafetyCheckEntry, SafetyCheckRepository } from "../ports/outbound/safety-check-repository";

export interface ViewEventSafetyChecksCommand {
  /** The coordinator viewing their event. */
  readonly userAccountId: string;
  readonly eventId: string;
}

/** The Safety check card on a coordinator's event page (SPM-261). */
export interface EventSafetyChecksView {
  /** Newest first. */
  readonly checks: readonly SafetyCheckEntry[];
  /** Whether to offer Resubmit for safety check (AC3). */
  readonly canResubmit: boolean;
}

export interface ViewEventSafetyChecksDeps {
  readonly safetyChecks: SafetyCheckRepository;
}

/**
 * SPM-261 AC2: what the Safety Officer said about an event, for its assigned
 * coordinator. Null when the event is not theirs (#91). Whether it can go back
 * for another check is `canResubmitForSafetyCheck`'s call.
 */
export class ViewEventSafetyChecksUseCase {
  constructor(private readonly deps: ViewEventSafetyChecksDeps) {}

  async execute(command: ViewEventSafetyChecksCommand): Promise<EventSafetyChecksView | null> {
    const history = await this.deps.safetyChecks.history(
      userAccountId(command.userAccountId),
      eventId(command.eventId),
    );
    if (history === null) {
      return null;
    }

    return {
      checks: history.checks,
      canResubmit: canResubmitForSafetyCheck(history.eventStatus, history.checks[0] ?? null),
    };
  }
}
