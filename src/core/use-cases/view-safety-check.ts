import { EventNotFoundError } from "../domain/errors";
import { eventId } from "../domain/event";
import { awaitsSafetyCheck } from "../domain/safety-check";
import { userAccountId } from "../domain/user-account";
import type {
  SafetyCheckEntry,
  SafetyCheckEquipment,
  SafetyCheckRepository,
  SafetyCheckVenue,
} from "../ports/outbound/safety-check-repository";

export interface ViewSafetyCheckCommand {
  /** The Safety Officer reviewing. */
  readonly userAccountId: string;
  readonly eventId: string;
}

/** One event on the Safety Officer's review page (SPM-260). */
export interface SafetyCheckView {
  readonly eventId: string;
  readonly eventName: string;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly preferredDate: string | null;
  readonly expectedAttendance: number | null;
  readonly accessibilityRequirements: string | null;
  readonly venues: readonly SafetyCheckVenue[];
  readonly equipment: readonly SafetyCheckEquipment[];
  /** Newest first. */
  readonly checks: readonly SafetyCheckEntry[];
  /** Whether an outcome can be recorded now (AC6). */
  readonly awaitsCheck: boolean;
}

export interface ViewSafetyCheckDeps {
  readonly safetyChecks: SafetyCheckRepository;
}

/**
 * SPM-260 AC1, AC5: what the customer listed for an event, and the outcomes
 * already recorded on it. Whether it can take one now is `awaitsSafetyCheck`'s
 * call.
 */
export class ViewSafetyCheckUseCase {
  constructor(private readonly deps: ViewSafetyCheckDeps) {}

  async execute(command: ViewSafetyCheckCommand): Promise<SafetyCheckView> {
    const review = await this.deps.safetyChecks.review(
      userAccountId(command.userAccountId),
      eventId(command.eventId),
    );
    if (review === null) {
      throw new EventNotFoundError(command.eventId);
    }

    const { event } = review.candidate;
    return {
      eventId: event.id,
      eventName: event.name,
      preferredDate: event.preferredDate,
      expectedAttendance: event.expectedAttendance,
      accessibilityRequirements: review.accessibilityRequirements,
      venues: review.venues,
      equipment: review.equipment,
      checks: review.checks,
      awaitsCheck: awaitsSafetyCheck(review.candidate),
    };
  }
}
