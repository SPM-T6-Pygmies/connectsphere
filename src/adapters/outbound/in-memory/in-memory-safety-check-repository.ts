import { EventNotAwaitingSafetyCheckError, NotSafetyOfficerError } from "@/core/domain/errors";
import type { EventId } from "@/core/domain/event";
import type { RecordedSafetyCheck } from "@/core/domain/safety-check";
import type { UserAccountId } from "@/core/domain/user-account";
import type { Clock } from "@/core/ports/outbound/clock";
import type { SafetyCheckRepository, SafetyCheckReview } from "@/core/ports/outbound/safety-check-repository";

/** Safety checks held in memory, for tests and local wiring. */
export class InMemorySafetyCheckRepository implements SafetyCheckRepository {
  private readonly events: SafetyCheckReview[];

  constructor(
    seed: readonly SafetyCheckReview[],
    /** Each Safety Officer's id and name; anyone else is refused. */
    private readonly officers: Readonly<Record<string, string>>,
    private readonly clock: Clock,
  ) {
    this.events = [...seed];
  }

  async review(reader: UserAccountId, event: EventId): Promise<SafetyCheckReview | null> {
    this.requireOfficer(reader);
    return this.events.find((review) => review.candidate.event.id === event) ?? null;
  }

  async record(check: RecordedSafetyCheck): Promise<void> {
    this.requireOfficer(check.checkedBy);
    const index = this.events.findIndex((review) => review.candidate.event.id === check.eventId);
    const review = this.events[index];
    if (review === undefined || review.candidate.checked || review.candidate.event.status !== "Planning") {
      throw new EventNotAwaitingSafetyCheckError();
    }

    this.events[index] = {
      ...review,
      candidate: { ...review.candidate, checked: true },
      checks: [
        {
          outcome: check.outcome,
          comments: check.comments,
          checkedByName: this.officers[check.checkedBy] ?? check.checkedBy,
          checkedAt: this.clock.now().toISOString(),
        },
        ...review.checks,
      ],
    };
  }

  private requireOfficer(account: UserAccountId): void {
    if (!(account in this.officers)) {
      throw new NotSafetyOfficerError();
    }
  }
}
