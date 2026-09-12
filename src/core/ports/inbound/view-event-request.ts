import type { EventRequest } from "../../domain/event-request";

export interface ViewEventRequestCommand {
  readonly id: string;
  readonly userAccountId: string;
  readonly clientOrganisationId: string;
}

export interface ViewEventRequestResult {
  readonly eventRequest: EventRequest;
}

export interface ViewEventRequest {
  /** Null when there is no such request, or the caller may not see it -- the caller should treat both the same way (not found), per `eventRequestAccessFor`. */
  execute(command: ViewEventRequestCommand): Promise<ViewEventRequestResult | null>;
}
