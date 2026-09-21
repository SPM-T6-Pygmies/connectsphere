import {
  clarificationMessageId,
  type ClarificationMessage,
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

  /** Assigns the id the way the real store does -- the caller does not choose it. */
  async append(message: NewClarificationMessage): Promise<ClarificationMessage> {
    this.sequence += 1;
    const stored: ClarificationMessage = {
      ...message,
      id: clarificationMessageId(`message-${this.sequence}`),
    };
    this.rows.push(stored);
    return stored;
  }

  /**
   * Test-only window on what was stored, so a test can assert nothing was
   * written -- matching `InMemoryEventRequestRepository.all()`.
   */
  all(): readonly ClarificationMessage[] {
    return [...this.rows];
  }
}
