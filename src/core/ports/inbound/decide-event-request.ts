import type { EventRequestStatus } from "../../domain/event-request";

export interface DecideEventRequestCommand {
  readonly id: string;
  /** The Event Coordinator making the decision. */
  readonly userAccountId: string;
  readonly decision: "approve" | "reject";
  /** The reason when rejecting (required), or an optional note when approving. */
  readonly decisionRecord: string;
}

export interface DecideEventRequestResult {
  readonly eventRequestId: string;
  readonly status: EventRequestStatus;
}

export interface DecideEventRequest {
  /** Throws `EventRequestNotFoundError` both when there is no such request and when it isn't assigned to this caller (#91). */
  execute(command: DecideEventRequestCommand): Promise<DecideEventRequestResult>;
}
