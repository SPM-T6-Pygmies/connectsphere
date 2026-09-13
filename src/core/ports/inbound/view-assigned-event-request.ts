import type { EventRequest } from "../../domain/event-request";

export interface ViewAssignedEventRequestCommand {
  readonly id: string;
  readonly userAccountId: string;
}

export interface ViewAssignedEventRequestResult {
  readonly eventRequest: EventRequest;
  readonly requestingOrganiserName: string;
  readonly clientOrganisationName: string;
}

export interface ViewAssignedEventRequest {
  /** Null when there is no such request, or it isn't assigned to this caller -- the caller should treat both the same way (not found), per `eventRequestAccessForCoordinator` (#91). */
  execute(command: ViewAssignedEventRequestCommand): Promise<ViewAssignedEventRequestResult | null>;
}
