import {
  clarificationMessageId,
  type ClarificationMessage,
  type ClarificationMessageId,
  type NewClarificationMessage,
} from "@/core/domain/clarification-message";
import type { EventRequestId } from "@/core/domain/event-request";
import type { ClarificationThreadRepository } from "@/core/ports/outbound/clarification-thread-repository";

export class InMemoryClarificationThreadRepository implements ClarificationThreadRepository {
  private readonly rows: ClarificationMessage[] = [];
  private sequence = 0;

  constructor(seed: readonly ClarificationMessage[] = []) {
    this.rows.push(...seed);
  }

  async messagesFor(eventRequestId: EventRequestId): Promise<readonly ClarificationMessage[]> {
    return this.rows
      .filter((message) => message.eventRequestId === eventRequestId)
      .sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());
  }

  /**
   * Assigns the id and the time the way the real store does -- the caller
   * chooses neither.
   *
   * The instant is derived from the sequence rather than the wall clock so
   * that `messagesFor`'s ordering is deterministic in tests, the same
   * pragmatism as `InMemoryEventRequestRepository.create`'s `new Date(0)`.
   */
  async append(message: NewClarificationMessage): Promise<ClarificationMessage> {
    this.sequence += 1;
    const stored: ClarificationMessage = {
      ...message,
      id: clarificationMessageId(`message-${this.sequence}`),
      postedAt: new Date(this.sequence),
      resolvedAt: null,
    };
    this.rows.push(stored);
    return stored;
  }

  /** Marks a question answered, the way `coordinator_resolve_clarification_thread` does. */
  async resolve(messageId: ClarificationMessageId, resolvedAt: Date): Promise<void> {
    const index = this.rows.findIndex((message) => message.id === messageId);
    if (index !== -1) {
      this.rows[index] = { ...this.rows[index], resolvedAt };
    }
  }

  /**
   * Test-only window on what was stored, so a test can assert nothing was
   * written -- matching `InMemoryEventRequestRepository.all()`.
   */
  all(): readonly ClarificationMessage[] {
    return [...this.rows];
  }
}
