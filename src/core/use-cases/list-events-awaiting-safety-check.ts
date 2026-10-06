import { awaitsSafetyCheck, confirmedVenues } from "../domain/safety-check";
import { userAccountId } from "../domain/user-account";
import type { SafetyCheckCandidateRepository } from "../ports/outbound/safety-check-candidate-repository";

/** One row on the Safety Officer's "Awaiting check" list (SPM-259 AC5). */
export interface EventAwaitingSafetyCheck {
  readonly eventId: string;
  readonly eventName: string;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly preferredDate: string | null;
  readonly expectedAttendance: number | null;
  /** Each venue the event is confirmed at, alphabetically. */
  readonly venues: readonly string[];
}

export interface ListEventsAwaitingSafetyCheckCommand {
  /** The Safety Officer reading the list. */
  readonly userAccountId: string;
}

export interface ListEventsAwaitingSafetyCheckResult {
  readonly events: readonly EventAwaitingSafetyCheck[];
}

export interface ListEventsAwaitingSafetyCheckDeps {
  readonly candidates: SafetyCheckCandidateRepository;
}

/**
 * SPM-259: the events whose venue and equipment are confirmed, for the Safety
 * Officer to check. The caller is the page's Safety Officer context --
 * `safetyOfficerContextFor` gives none to anyone else (AC7). Which events
 * qualify is `awaitsSafetyCheck`'s call, not this one's.
 */
export class ListEventsAwaitingSafetyCheckUseCase {
  constructor(private readonly deps: ListEventsAwaitingSafetyCheckDeps) {}

  async execute(command: ListEventsAwaitingSafetyCheckCommand): Promise<ListEventsAwaitingSafetyCheckResult> {
    const candidates = await this.deps.candidates.candidates(userAccountId(command.userAccountId));

    return {
      events: candidates.filter(awaitsSafetyCheck).map((candidate) => ({
        eventId: candidate.event.id,
        eventName: candidate.event.name,
        preferredDate: candidate.event.preferredDate,
        expectedAttendance: candidate.event.expectedAttendance,
        venues: confirmedVenues(candidate),
      })),
    };
  }
}
