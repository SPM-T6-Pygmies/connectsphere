import { EventNotFoundError } from "../domain/errors";
import { eventId } from "../domain/event";
import { recordSafetyCheck, type SafetyCheckOutcome } from "../domain/safety-check";
import { userAccountId } from "../domain/user-account";
import type { Notifier } from "../ports/outbound/notifier";
import type { SafetyCheckRepository } from "../ports/outbound/safety-check-repository";

export interface RecordSafetyCheckCommand {
  /** The Safety Officer recording the outcome. */
  readonly userAccountId: string;
  readonly eventId: string;
  readonly outcome: SafetyCheckOutcome;
  /** As typed; required for a rejection (AC3). */
  readonly comments: string;
}

export interface RecordSafetyCheckDeps {
  readonly safetyChecks: SafetyCheckRepository;
  readonly notifier: Pick<Notifier, "safetyCheckRecorded">;
}

/**
 * SPM-260: a Safety Officer records Approved or Rejected on an event. Whether
 * the event can take an outcome and whether a rejection says enough are
 * `recordSafetyCheck`'s calls -- this file reads the event and stores the result.
 *
 * SPM-263: then it tells the event's assigned coordinator, if it has one. The
 * outcome is stored first, so a notice that fails to send cannot undo it
 * (AC6); composition's notifier records a failure rather than throwing.
 */
export class RecordSafetyCheckUseCase {
  constructor(private readonly deps: RecordSafetyCheckDeps) {}

  async execute(command: RecordSafetyCheckCommand): Promise<void> {
    const officer = userAccountId(command.userAccountId);
    const review = await this.deps.safetyChecks.review(officer, eventId(command.eventId));
    if (review === null) {
      throw new EventNotFoundError(command.eventId);
    }

    const recorded = recordSafetyCheck(review.candidate, command.outcome, command.comments, officer);
    await this.deps.safetyChecks.record(recorded);

    if (review.coordinatorUserAccountId !== null) {
      await this.deps.notifier.safetyCheckRecorded({
        recipientUserAccountId: review.coordinatorUserAccountId,
        eventId: recorded.eventId,
        eventName: review.candidate.event.name,
        outcome: recorded.outcome,
        comments: recorded.comments,
      });
    }
  }
}
