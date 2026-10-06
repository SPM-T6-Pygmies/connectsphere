import { EventNotFoundError, SafetyCheckNotResubmittableError } from "../domain/errors";
import { eventId } from "../domain/event";
import { canResubmitForSafetyCheck } from "../domain/safety-check";
import { userAccountId } from "../domain/user-account";
import type { SafetyCheckRepository } from "../ports/outbound/safety-check-repository";
import type { SafetyCheckEntryAnnouncer } from "./announce-safety-check-entry";

export interface ResubmitForSafetyCheckCommand {
  /** The event's assigned coordinator. */
  readonly userAccountId: string;
  readonly eventId: string;
}

export interface ResubmitForSafetyCheckDeps {
  readonly safetyChecks: SafetyCheckRepository;
  readonly safetyCheck: Pick<SafetyCheckEntryAnnouncer, "around">;
}

/**
 * SPM-261 AC3: the coordinator sends a rejected event back for a fresh check.
 * Whether it can go is `canResubmitForSafetyCheck`'s call. An event that is
 * not theirs is refused like one that does not exist (#91).
 *
 * AC4: resubmitting can put the event straight back on the Awaiting check
 * list, so it runs through the SPM-262 announcer like any other change that
 * can.
 */
export class ResubmitForSafetyCheckUseCase {
  constructor(private readonly deps: ResubmitForSafetyCheckDeps) {}

  async execute(command: ResubmitForSafetyCheckCommand): Promise<void> {
    const event = eventId(command.eventId);
    await this.deps.safetyCheck.around({ eventId: event }, () => this.resubmit(command, event));
  }

  private async resubmit(command: ResubmitForSafetyCheckCommand, event: ReturnType<typeof eventId>): Promise<void> {
    const coordinator = userAccountId(command.userAccountId);
    const history = await this.deps.safetyChecks.history(coordinator, event);
    if (history === null) {
      throw new EventNotFoundError(command.eventId);
    }
    if (!canResubmitForSafetyCheck(history.eventStatus, history.checks[0] ?? null)) {
      throw new SafetyCheckNotResubmittableError();
    }

    await this.deps.safetyChecks.resubmit(coordinator, event);
  }
}
