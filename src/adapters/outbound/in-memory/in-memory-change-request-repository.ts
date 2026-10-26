import type { ChangeRequestTarget } from "@/core/domain/change-request";
import type { EventRequestId } from "@/core/domain/event-request";
import type { ChangeRequestRepository, NewChangeRequest } from "@/core/ports/outbound/change-request-repository";

export class InMemoryChangeRequestRepository implements ChangeRequestRepository {
  private readonly targets: Map<string, ChangeRequestTarget>;
  private readonly submitted: NewChangeRequest[] = [];

  constructor(targets: Readonly<Record<string, ChangeRequestTarget>> = {}) {
    this.targets = new Map(Object.entries(targets));
  }

  async findTarget(eventRequestId: EventRequestId): Promise<ChangeRequestTarget | null> {
    return this.targets.get(eventRequestId) ?? null;
  }

  /** A stored request is open until it is decided, as `organiser_change_request_target` reads it. */
  async submit(changeRequest: NewChangeRequest): Promise<void> {
    this.submitted.push(changeRequest);
    const target = this.targets.get(changeRequest.eventRequestId);
    if (target !== undefined) {
      this.targets.set(changeRequest.eventRequestId, { ...target, hasOpenChangeRequest: true });
    }
  }

  /** Test-only window on what was stored, matching `InMemoryEventRequestRepository.all()`. */
  all(): readonly NewChangeRequest[] {
    return [...this.submitted];
  }
}
