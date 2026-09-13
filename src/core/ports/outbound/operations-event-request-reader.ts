import type { EventRequest, EventRequestId } from "../../domain/event-request";

/** Read-side access to one event request for Event Operations. */
export interface OperationsEventRequestReader {
  findById(id: EventRequestId): Promise<EventRequest | null>;
}
