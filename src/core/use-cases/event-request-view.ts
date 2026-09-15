import type {
  EventRequest,
  EventRequestDetails,
  EventRequestStatus,
} from "../domain/event-request";

/**
 * One event request as a detail screen shows it.
 *
 * Plain data, like `OperationsEventRequest`: a string id and an ISO timestamp
 * rather than a branded id and a `Date`, so a page renders it without knowing
 * the domain's types.
 */
export interface EventRequestView {
  readonly id: string;
  readonly status: EventRequestStatus;
  readonly details: EventRequestDetails;
  readonly decisionRecord: string | null;
  /** ISO 8601. Null for a request still in Draft -- it has never been submitted. */
  readonly submittedAt: string | null;
}

/** Domain object to the detail screens' view. */
export function toEventRequestView(request: EventRequest): EventRequestView {
  return {
    id: request.id,
    status: request.status,
    details: request.details,
    decisionRecord: request.decisionRecord,
    submittedAt: request.submittedAt?.toISOString() ?? null,
  };
}
