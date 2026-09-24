import type {
  ClarificationMessage,
  ClarificationMessageId,
  NewClarificationMessage,
} from "../../domain/clarification-message";
import type { EventRequestId } from "../../domain/event-request";

/**
 * Where an event request's clarification thread is kept (SPM-33 AC4): the
 * clarification request and every reply, retained with the record and readable
 * by both the Coordinator and the Organiser.
 *
 * Role-named rather than technology-named (ARCHITECTURE.md section 7) -- the
 * core asks for somewhere to keep a conversation and knows nothing about the
 * table, the RPC or the RLS behind it.
 *
 * Read-and-append only. Nothing edits or deletes a message: #102 keeps a
 * submitted request from being rewritten, and a thread whose entries can be
 * changed after the fact is not the retained record that AC4 asks for.
 */
export interface ClarificationThreadRepository {
  /** Every message on this request, oldest first. Empty when nothing has been said. */
  messagesFor(eventRequestId: EventRequestId): Promise<readonly ClarificationMessage[]>;
  /** Stores a message the core has built and hands back the id the store chose. */
  append(message: NewClarificationMessage): Promise<ClarificationMessage>;
  /**
   * Marks one question answered.
   *
   * Not called directly by a use case: resolving a question can also move the
   * request, and the two are one unit of work, so it goes through
   * `EventRequestRepository.resolveClarificationThread`. It lives on this port
   * because this is the store that owns the row.
   */
  resolve(messageId: ClarificationMessageId, resolvedAt: Date): Promise<void>;
}
