import {
  changeRequestStatus,
  type ChangeRequest,
  type ChangeRequestId,
  type ChangeRequestItem,
  type ChangeRequestTarget,
} from "@/core/domain/change-request";
import type { EventId } from "@/core/domain/event";
import type { EventRequestId } from "@/core/domain/event-request";
import type { UserAccountId } from "@/core/domain/user-account";
import type { ChangeRequestRepository, NewChangeRequest } from "@/core/ports/outbound/change-request-repository";

/**
 * Requests to decide are seeded per event id. Who may see them is the
 * coordinator event repository's call, which the use cases ask first.
 */
export class InMemoryChangeRequestRepository implements ChangeRequestRepository {
  private readonly targets: Map<string, ChangeRequestTarget>;
  private readonly submitted: NewChangeRequest[] = [];
  private readonly requests: Map<string, ChangeRequest[]>;

  constructor(
    targets: Readonly<Record<string, ChangeRequestTarget>> = {},
    requests: Readonly<Record<string, readonly ChangeRequest[]>> = {},
  ) {
    this.targets = new Map(Object.entries(targets));
    this.requests = new Map(Object.entries(requests).map(([event, list]) => [event, [...list]]));
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

  async listForEvent(_coordinatorId: UserAccountId, eventId: EventId): Promise<readonly ChangeRequest[]> {
    return [...(this.requests.get(eventId) ?? [])].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  /** Decided, the request is no longer open, as `organiser_change_request_target` reads it. */
  async decide(_coordinatorId: UserAccountId, id: ChangeRequestId, items: readonly ChangeRequestItem[]): Promise<void> {
    for (const [event, list] of this.requests) {
      const index = list.findIndex((request) => request.id === id);
      if (index === -1) {
        continue;
      }
      const decided = { ...list[index], items };
      list[index] = decided;
      for (const [key, target] of this.targets) {
        if (target.eventId === event && changeRequestStatus(decided) === "Decided") {
          this.targets.set(key, { ...target, hasOpenChangeRequest: false });
        }
      }
    }
  }

  /** Test-only window on what was stored, matching `InMemoryEventRequestRepository.all()`. */
  all(): readonly NewChangeRequest[] {
    return [...this.submitted];
  }
}
