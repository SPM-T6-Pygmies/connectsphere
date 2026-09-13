import type { EventRequest } from "../../domain/event-request";

export interface ViewOrganiserEventRequestCommand {
  readonly id: string;
  readonly userAccountId: string;
  readonly clientOrganisationId: string;
}

export interface ViewOrganiserEventRequestResult {
  readonly eventRequest: EventRequest;
}

export interface ViewOrganiserEventRequest {
  /** Null when there is no such request, or the caller may not see it -- the caller should treat both the same way (not found), per `eventRequestAccessFor`. */
  execute(
    command: ViewOrganiserEventRequestCommand,
  ): Promise<ViewOrganiserEventRequestResult | null>;
}
